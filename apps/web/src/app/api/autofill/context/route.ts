import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

const CONTEXT_ID = "default";
const contextInclude = { application: { include: { job: true } }, job: true } satisfies Prisma.AutofillContextInclude;
type AutofillContextPayload = Prisma.AutofillContextGetPayload<{ include: typeof contextInclude }>;

function hostFromUrl(value?: string | null) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function serializeContext(context: AutofillContextPayload | null) {
  if (!context) return null;

  return {
    id: context.id,
    applicationId: context.applicationId,
    jobId: context.jobId,
    urlHint: context.urlHint,
    hostHint: context.hostHint,
    status: context.status,
    expiresAt: context.expiresAt?.toISOString() ?? null,
    updatedAt: context.updatedAt.toISOString(),
    application: context.application
      ? {
          id: context.application.id,
          status: context.application.status,
          job: context.application.job
            ? {
                id: context.application.job.id,
                company: context.application.job.company,
                title: context.application.job.title,
                sourceUrl: context.application.job.sourceUrl
              }
            : null
        }
      : null
  };
}

function isExpired(expiresAt?: Date | null) {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

export async function GET(request: Request) {
  await ensureSeedData();
  const { searchParams } = new URL(request.url);
  const currentUrl = searchParams.get("url");
  const currentHost = hostFromUrl(currentUrl);

  const context = await prisma.autofillContext.findUnique({
    where: { id: CONTEXT_ID },
    include: contextInclude
  });

  if (!context || context.status !== "active" || isExpired(context.expiresAt)) {
    return NextResponse.json({ context: null, matchMode: "none" });
  }

  const hostMatches = Boolean(currentHost && context.hostHint && (currentHost.includes(context.hostHint) || context.hostHint.includes(currentHost)));

  return NextResponse.json({
    context: serializeContext(context),
    matchMode: hostMatches ? "host" : "active"
  });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.applicationId) {
    return NextResponse.json({ error: "缺少申请记录 ID。" }, { status: 400 });
  }

  const application = await prisma.application.findUnique({
    where: { id: String(body.applicationId) },
    include: { job: true }
  });

  if (!application) {
    return NextResponse.json({ error: "没有找到申请记录。" }, { status: 404 });
  }

  const ttlMinutes = Math.max(15, Math.min(480, Number(body.ttlMinutes ?? 120)));
  const urlHint = body.urlHint ? String(body.urlHint) : application.job.sourceUrl;
  const context = await prisma.autofillContext.upsert({
    where: { id: CONTEXT_ID },
    create: {
      id: CONTEXT_ID,
      applicationId: application.id,
      jobId: application.jobId,
      urlHint,
      hostHint: hostFromUrl(urlHint),
      status: "active",
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000)
    },
    update: {
      applicationId: application.id,
      jobId: application.jobId,
      urlHint,
      hostHint: hostFromUrl(urlHint),
      status: "active",
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000)
    },
    include: contextInclude
  });

  return NextResponse.json({ context: serializeContext(context) });
}

export async function DELETE() {
  await ensureSeedData();
  await prisma.autofillContext.deleteMany({ where: { id: CONTEXT_ID } });
  return NextResponse.json({ context: null });
}
