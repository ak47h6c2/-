import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMaterialDrafts } from "@/lib/materials";
import { jsonError } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

function parseJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.jobId) {
    return jsonError("缺少岗位 ID。");
  }

  const job = await prisma.job.findUnique({
    where: { id: String(body.jobId) },
    include: { parseResult: true }
  });

  if (!job) {
    return jsonError("岗位不存在。", 404);
  }

  const resume =
    (body.resumeVersionId
      ? await prisma.resumeVersion.findUnique({ where: { id: String(body.resumeVersionId) } })
      : await prisma.resumeVersion.findFirst({
          where: { OR: [{ market: job.market, isDefault: true }, { market: null, isDefault: true }] },
          orderBy: { updatedAt: "desc" }
        })) ?? null;

  const answers = await prisma.answerVaultItem.findMany({
    where: { OR: [{ market: job.market }, { market: "GLOBAL" }, { market: null }] },
    orderBy: { updatedAt: "desc" },
    take: 5
  });
  const parseReasons = [
    ...parseJsonArray(job.parseResult?.positiveReasonsJson),
    ...parseJsonArray(job.parseResult?.negativeReasonsJson)
  ];
  const drafts = buildMaterialDrafts({ job, resume, answers, parseReasons });

  const created = [];

  for (const draft of drafts) {
    const existing = await prisma.materialDraft.findFirst({
      where: { jobId: job.id, draftType: draft.draftType }
    });

    created.push(
      existing
        ? await prisma.materialDraft.update({
            where: { id: existing.id },
            data: { ...draft, resumeVersionId: resume?.id, status: "draft" }
          })
        : await prisma.materialDraft.create({
            data: { ...draft, jobId: job.id, resumeVersionId: resume?.id }
          })
    );
  }

  return NextResponse.json({ drafts: created });
}
