import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeMarket, parseOptionalDate } from "@/lib/api-utils";
import { ensureSeedData, makeJobHash } from "@/lib/seed";
import { scoreJob } from "@/lib/job-matching";

function clampScore(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function serializeJob(job: Awaited<ReturnType<typeof prisma.job.findMany>>[number]) {
  return {
    ...job,
    postedAt: job.postedAt?.toISOString() ?? null,
    firstSeenAt: job.firstSeenAt.toISOString(),
    lastSeenAt: job.lastSeenAt.toISOString(),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString()
  };
}

export async function GET() {
  await ensureSeedData();
  const jobs = await prisma.job.findMany({
    orderBy: [{ matchScore: "desc" }, { firstSeenAt: "desc" }],
    include: {
      source: true,
      applications: { orderBy: { updatedAt: "desc" }, take: 1 }
    }
  });

  return NextResponse.json({ jobs: jobs.map(serializeJob) });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.title || !body?.company) {
    return jsonError("岗位标题和公司不能为空。");
  }

  const market = normalizeMarket(body.market);
  const sourceHash = makeJobHash({
    market,
    company: String(body.company),
    title: String(body.title),
    sourceUrl: emptyToNull(body.sourceUrl)
  });

  const manualSource = await prisma.jobSource.findFirst({ where: { name: "手动录入" } });
  const existing = await prisma.job.findFirst({ where: { sourceHash } });
  const scored = scoreJob({
    market,
    title: String(body.title),
    company: String(body.company),
    location: emptyToNull(body.location),
    description: emptyToNull(body.description),
    sourceUrl: emptyToNull(body.sourceUrl)
  });
  const data = {
    sourceId: manualSource?.id,
    market,
    title: String(body.title).trim(),
    company: String(body.company).trim(),
    location: emptyToNull(body.location),
    sourceUrl: emptyToNull(body.sourceUrl),
    description: String(body.description || "手动录入岗位，待补充岗位描述。"),
    language: market === "CN" ? "zh" : "en",
    postedAt: parseOptionalDate(body.postedAt),
    lastSeenAt: new Date(),
    matchScore: body.matchScore === "" || body.matchScore == null ? scored.matchScore : Number(body.matchScore),
    visaRisk: emptyToNull(body.visaRisk) ?? scored.visaRisk,
      graduateFit: emptyToNull(body.graduateFit) ?? scored.graduateFit,
      archived: Boolean(body.archived ?? false),
      sourceHash
    };

  const job = existing
    ? await prisma.job.update({ where: { id: existing.id }, data })
    : await prisma.job.create({ data });

  return NextResponse.json({ job: serializeJob(job), deduped: Boolean(existing) });
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return jsonError("岗位 ID 不能为空。");
  }

  const existing = await prisma.job.findUnique({ where: { id: String(body.id) } });
  if (!existing) {
    return jsonError("未找到岗位。", 404);
  }

  const market = body.market === undefined ? existing.market : normalizeMarket(body.market, existing.market);
  const title = body.title === undefined ? existing.title : String(body.title).trim();
  const company = body.company === undefined ? existing.company : String(body.company).trim();

  if (!title || !company) {
    return jsonError("岗位标题和公司不能为空。");
  }

  const location = body.location === undefined ? existing.location : emptyToNull(body.location);
  const sourceUrl = body.sourceUrl === undefined ? existing.sourceUrl : emptyToNull(body.sourceUrl);
  const description =
    body.description === undefined
      ? existing.description
      : String(body.description ?? "").trim() || "岗位描述待补充。";
  const scored = scoreJob({
    market,
    title,
    company,
    location,
    description,
    sourceUrl
  });
  const matchScore =
    body.matchScore === undefined || body.matchScore === null || body.matchScore === ""
      ? (existing.matchScore ?? scored.matchScore)
      : clampScore(body.matchScore, existing.matchScore ?? scored.matchScore);
  const sourceHash = makeJobHash({ market, company, title, sourceUrl });

  const job = await prisma.job.update({
    where: { id: existing.id },
    data: {
      market,
      title,
      company,
      location,
      sourceUrl,
      description,
      language: body.language === undefined ? existing.language : String(body.language || existing.language),
      postedAt: body.postedAt === undefined ? existing.postedAt : parseOptionalDate(body.postedAt),
      matchScore,
      visaRisk: body.visaRisk === undefined ? existing.visaRisk : (emptyToNull(body.visaRisk) ?? scored.visaRisk),
      graduateFit: body.graduateFit === undefined ? existing.graduateFit : (emptyToNull(body.graduateFit) ?? scored.graduateFit),
      archived: body.archived === undefined ? existing.archived : Boolean(body.archived),
      sourceHash
    },
    include: {
      source: true,
      applications: { orderBy: { updatedAt: "desc" }, take: 1 }
    }
  });

  return NextResponse.json({ job: serializeJob(job) });
}
