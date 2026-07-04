import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";
import { buildTaskPackage, scoreJob } from "@/lib/job-matching";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

async function getTodayPlan() {
  const { start, end } = getTodayRange();
  return prisma.dailyApplyPlan.findFirst({
    where: { planDate: { gte: start, lt: end } },
    orderBy: { generatedAt: "desc" },
    include: {
      tasks: {
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: { job: { include: { applications: true } }, package: true }
      }
    }
  });
}

export async function GET() {
  await ensureSeedData();
  return NextResponse.json({ plan: await getTodayPlan() });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => ({}));
  const targetCount = Math.max(1, Math.min(12, Number(body?.targetCount || 5)));
  const { start, end } = getTodayRange();

  const jobs = await prisma.job.findMany({
    where: { archived: false },
    orderBy: [{ matchScore: "desc" }, { firstSeenAt: "desc" }],
    include: { applications: true }
  });

  const candidates = jobs
    .filter((job) => !job.applications.some((application) => ["APPLIED", "OA", "INTERVIEW", "OFFER"].includes(application.status)))
    .map((job) => ({ job, scored: scoreJob(job) }))
    .sort((a, b) => b.scored.matchScore - a.scored.matchScore)
    .slice(0, targetCount);

  await prisma.dailyApplyPlan.deleteMany({
    where: { planDate: { gte: start, lt: end } }
  });

  const plan = await prisma.dailyApplyPlan.create({
    data: {
      planDate: start,
      targetCount,
      status: "active",
      tasks: {
        create: candidates.map(({ job, scored }, index) => ({
          jobId: job.id,
          priority: scored.matchScore - index,
          status: "queued",
          matchScore: scored.matchScore,
          riskLevel: scored.visaRisk,
          package: {
            create: buildTaskPackage({ ...job, ...scored })
          }
        }))
      }
    },
    include: {
      tasks: {
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        include: { job: { include: { applications: true } }, package: true }
      }
    }
  });

  return NextResponse.json({ plan });
}
