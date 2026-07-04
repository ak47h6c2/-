import { NextResponse } from "next/server";
import { serializeFormSnapshot } from "@/lib/autofill-workbench";
import { emptyToNull, normalizeStatus } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function serializeRun(run: Awaited<ReturnType<typeof prisma.autofillRun.findMany>>[number]) {
  return {
    id: run.id,
    applicationId: run.applicationId,
    snapshotId: run.snapshotId,
    url: run.url,
    atsVendor: run.atsVendor,
    mode: run.mode,
    fieldsDetected: run.fieldsDetected,
    fieldsFilled: run.fieldsFilled,
    fieldsSkipped: run.fieldsSkipped,
    createdAt: run.createdAt.toISOString()
  };
}

function buildReadiness(input: {
  application: unknown;
  drafts: Array<{ draftType: string }>;
  recommendedResume: unknown;
  boundSnapshots: Array<{ safeCount: number; reviewCount: number }>;
  visaRisk?: string | null;
}) {
  const draftTypes = new Set(input.drafts.map((draft) => draft.draftType));
  const checks = [
    {
      key: "application",
      label: "创建申请记录",
      done: Boolean(input.application),
      detail: input.application ? "已进入投递管线" : "先创建申请记录，后续状态和表单快照才能绑定"
    },
    {
      key: "resume",
      label: "选择简历版本",
      done: Boolean(input.recommendedResume),
      detail: input.recommendedResume ? "已有推荐简历版本" : "材料库还没有可用简历版本"
    },
    {
      key: "materials",
      label: "生成材料草稿",
      done: input.drafts.length >= 3,
      detail: input.drafts.length >= 3 ? "已生成完整材料包" : `当前只有 ${input.drafts.length} 条草稿`
    },
    {
      key: "coverLetter",
      label: "Cover Letter 草稿",
      done: draftTypes.has("cover_letter"),
      detail: draftTypes.has("cover_letter") ? "已生成 Cover Letter 大纲" : "需要生成或补充 Cover Letter 草稿"
    },
    {
      key: "snapshot",
      label: "绑定 Edge 表单快照",
      done: input.boundSnapshots.length > 0,
      detail: input.boundSnapshots.length > 0 ? `已绑定 ${input.boundSnapshots.length} 个表单快照` : "打开申请表后用 Edge 扩展扫描并保存快照"
    },
    {
      key: "visa",
      label: "人工确认工作权利",
      done: !input.visaRisk || input.visaRisk === "低",
      detail: input.visaRisk === "高" ? "签证风险偏高，提交前必须人工确认" : "仍建议提交前核对工作权利问题"
    }
  ];
  const doneCount = checks.filter((item) => item.done).length;

  return {
    checks,
    doneCount,
    totalCount: checks.length,
    percent: Math.round((doneCount / checks.length) * 100)
  };
}

export async function GET(_request: Request, context: RouteContext) {
  await ensureSeedData();
  const { id } = await context.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      parseResult: true,
      applications: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { resume: true }
      }
    }
  });

  if (!job) {
    return NextResponse.json({ error: "没有找到岗位。" }, { status: 404 });
  }

  const application = job.applications[0] ?? null;
  const [
    drafts,
    recommendedResume,
    answers,
    boundSnapshots,
    availableSnapshots,
    recentRuns,
    mappingRuleCount,
    activeContext
  ] = await Promise.all([
    prisma.materialDraft.findMany({
      where: { jobId: job.id },
      orderBy: { updatedAt: "desc" },
      include: { job: true, resumeVersion: true }
    }),
    prisma.resumeVersion.findFirst({
      where: {
        OR: [
          { market: job.market, isDefault: true },
          { market: null, isDefault: true },
          { market: job.market },
          { market: null }
        ]
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    }),
    prisma.answerVaultItem.findMany({
      where: { OR: [{ market: job.market }, { market: "GLOBAL" }, { market: null }] },
      orderBy: { updatedAt: "desc" },
      take: 5
    }),
    application
      ? prisma.formSnapshot.findMany({
          where: { applicationId: application.id },
          orderBy: { updatedAt: "desc" },
          include: { fields: { orderBy: [{ required: "desc" }, { confidence: "desc" }, { createdAt: "asc" }] } }
        })
      : Promise.resolve([]),
    prisma.formSnapshot.findMany({
      where: application ? { OR: [{ applicationId: null }, { applicationId: application.id }] } : { applicationId: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { fields: { orderBy: [{ required: "desc" }, { confidence: "desc" }, { createdAt: "asc" }] } }
    }),
    application
      ? prisma.autofillRun.findMany({
          where: {
            OR: [
              { applicationId: application.id },
              { snapshot: { applicationId: application.id } }
            ]
          },
          orderBy: { createdAt: "desc" },
          take: 8
        })
      : Promise.resolve([]),
    prisma.fieldMappingRule.count({ where: { enabled: true } }),
    prisma.autofillContext.findUnique({ where: { id: "default" } }).catch(() => null)
  ]);

  const edgeContext =
    application && activeContext?.applicationId === application.id && activeContext.status === "active" && (!activeContext.expiresAt || activeContext.expiresAt.getTime() > Date.now())
      ? {
          active: true,
          urlHint: activeContext.urlHint,
          hostHint: activeContext.hostHint,
          expiresAt: activeContext.expiresAt?.toISOString() ?? null
        }
      : null;

  const readiness = buildReadiness({
    application,
    drafts,
    recommendedResume,
    boundSnapshots,
    visaRisk: job.visaRisk
  });

  return NextResponse.json({
    package: {
      job: {
        ...job,
        postedAt: job.postedAt?.toISOString() ?? null,
        firstSeenAt: job.firstSeenAt.toISOString(),
        lastSeenAt: job.lastSeenAt.toISOString(),
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        applications: undefined
      },
      parseResult: job.parseResult
        ? {
            id: job.parseResult.id,
            rawText: job.parseResult.rawText,
            keywords: parseJsonArray(job.parseResult.keywordsJson),
            positiveReasons: parseJsonArray(job.parseResult.positiveReasonsJson),
            negativeReasons: parseJsonArray(job.parseResult.negativeReasonsJson),
            riskSignals: parseJsonArray(job.parseResult.riskSignalsJson),
            deadline: job.parseResult.deadline?.toISOString() ?? null,
            confidence: job.parseResult.confidence
          }
        : null,
      application,
      drafts,
      recommendedResume,
      answers,
      boundSnapshots: boundSnapshots.map(serializeFormSnapshot),
      availableSnapshots: availableSnapshots.map(serializeFormSnapshot),
      recentRuns: recentRuns.map(serializeRun),
      mappingRuleCount,
      readiness,
      edgeContext
    }
  });
}

export async function POST(request: Request, context: RouteContext) {
  await ensureSeedData();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const job = await prisma.job.findUnique({
    where: { id }
  });

  if (!job) {
    return NextResponse.json({ error: "岗位不存在。" }, { status: 404 });
  }

  const existing = await prisma.application.findFirst({
    where: { jobId: id },
    include: { job: true, resume: true, formSnapshots: true }
  });

  if (existing) {
    return NextResponse.json({ application: existing, deduped: true });
  }

  const application = await prisma.application.create({
    data: {
      jobId: id,
      status: normalizeStatus(body?.status, "PREPARED"),
      notes: emptyToNull(body?.notes ?? "来自投递包工作台")
    },
    include: { job: true, resume: true, formSnapshots: true }
  });

  return NextResponse.json({ application, deduped: false }, { status: 201 });
}
