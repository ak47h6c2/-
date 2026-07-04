import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeStatus, parseOptionalDate } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

const applicationInclude = {
  job: true,
  resume: true
};

function defaultNextAction(status: string) {
  if (status === "APPLIED") return "检查回信、笔试或面试通知";
  if (status === "PREPARED") return "核对材料并完成官方申请表";
  if (status === "OA") return "准备笔试并记录题目";
  if (status === "INTERVIEW") return "准备面试问题和复盘记录";
  return null;
}

export async function GET() {
  await ensureSeedData();
  const applications = await prisma.application.findMany({
    orderBy: { updatedAt: "desc" },
    include: applicationInclude
  });

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.jobId) {
    return jsonError("缺少要加入管线的岗位。");
  }

  const existing = await prisma.application.findFirst({
    where: { jobId: String(body.jobId) },
    include: applicationInclude
  });

  if (existing) {
    return NextResponse.json({ application: existing, deduped: true });
  }

  const status = normalizeStatus(body.status, "SAVED");
  const application = await prisma.application.create({
    data: {
      jobId: String(body.jobId),
      status,
      nextAction: emptyToNull(body.nextAction) ?? defaultNextAction(status),
      nextActionAt: parseOptionalDate(body.nextActionAt),
      notes: emptyToNull(body.notes)
    },
    include: applicationInclude
  });

  return NextResponse.json({ application, deduped: false });
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return jsonError("缺少投递记录 ID。");
  }

  const status = body.status ? normalizeStatus(body.status) : undefined;
  const application = await prisma.application.update({
    where: { id: String(body.id) },
    data: {
      status,
      notes: body.notes === undefined ? undefined : emptyToNull(body.notes),
      appliedAt: body.appliedAt === undefined ? undefined : parseOptionalDate(body.appliedAt) ?? null,
      responseAt: body.responseAt === undefined ? undefined : parseOptionalDate(body.responseAt) ?? null,
      nextAction: body.nextAction === undefined ? undefined : emptyToNull(body.nextAction),
      nextActionAt: body.nextActionAt === undefined ? undefined : parseOptionalDate(body.nextActionAt) ?? null
    },
    include: applicationInclude
  });

  return NextResponse.json({ application });
}
