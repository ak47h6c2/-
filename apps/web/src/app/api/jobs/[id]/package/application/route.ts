import { NextResponse } from "next/server";
import { emptyToNull, normalizeStatus, parseOptionalDate } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  await ensureSeedData();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "没有找到岗位。" }, { status: 404 });
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
      nextAction: emptyToNull(body?.nextAction) ?? "核对材料并完成官方申请表",
      nextActionAt: parseOptionalDate(body?.nextActionAt),
      notes: emptyToNull(body?.notes) ?? "来自投递包工作台"
    },
    include: { job: true, resume: true, formSnapshots: true }
  });

  return NextResponse.json({ application, deduped: false }, { status: 201 });
}
