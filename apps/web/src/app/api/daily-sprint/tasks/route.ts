import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeStatus, parseOptionalDate } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

const allowedTaskStatuses = new Set(["queued", "prepared", "applied", "skipped"]);

function toApplicationStatus(taskStatus: string) {
  if (taskStatus === "prepared") return "PREPARED";
  if (taskStatus === "applied") return "APPLIED";
  if (taskStatus === "skipped") return "SKIPPED";
  return "SAVED";
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return jsonError("缺少每日任务 ID。");
  }

  const status = String(body.status || "queued").toLowerCase();

  if (!allowedTaskStatuses.has(status)) {
    return jsonError("任务状态不合法。");
  }

  const task = await prisma.applyTask.update({
    where: { id: String(body.id) },
    data: {
      status,
      skipReason: status === "skipped" ? emptyToNull(body.skipReason) ?? "今日跳过" : null
    },
    include: { job: true, plan: { include: { tasks: true } }, package: true }
  });

  if (status !== "queued") {
    const appStatus = normalizeStatus(toApplicationStatus(status));
    const existing = await prisma.application.findFirst({ where: { jobId: task.jobId } });

    if (existing) {
      await prisma.application.update({
        where: { id: existing.id },
        data: {
          status: appStatus,
          appliedAt: appStatus === "APPLIED" && !existing.appliedAt ? new Date() : existing.appliedAt,
          nextAction: body.nextAction === undefined ? existing.nextAction : emptyToNull(body.nextAction),
          nextActionAt: body.nextActionAt === undefined ? existing.nextActionAt : parseOptionalDate(body.nextActionAt),
          notes: body.notes === undefined ? existing.notes : emptyToNull(body.notes)
        }
      });
    } else {
      await prisma.application.create({
        data: {
          jobId: task.jobId,
          status: appStatus,
          appliedAt: appStatus === "APPLIED" ? new Date() : null,
          nextAction: body.nextAction === undefined ? (appStatus === "APPLIED" ? "检查回信或笔试通知" : "准备材料并打开投递包") : emptyToNull(body.nextAction),
          nextActionAt: parseOptionalDate(body.nextActionAt),
          notes: body.notes === undefined ? `来自每日打卡：${task.job.title}` : emptyToNull(body.notes)
        }
      });
    }
  }

  const remainingQueued = await prisma.applyTask.count({
    where: { planId: task.planId, status: "queued" }
  });

  if (remainingQueued === 0) {
    await prisma.dailyApplyPlan.update({
      where: { id: task.planId },
      data: { status: "completed", completedAt: new Date() }
    });
  }

  const plan = await prisma.dailyApplyPlan.findUnique({
    where: { id: task.planId },
    include: {
      tasks: {
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: { job: { include: { applications: true } }, package: true }
      }
    }
  });

  return NextResponse.json({ task, plan });
}
