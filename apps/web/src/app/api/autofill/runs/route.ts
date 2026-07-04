import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();

  const runs = await prisma.autofillRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      snapshot: true,
      application: {
        include: {
          job: true
        }
      }
    }
  });

  return NextResponse.json({
    runs: runs.map((run) => ({
      id: run.id,
      applicationId: run.applicationId,
      snapshotId: run.snapshotId,
      url: run.url,
      atsVendor: run.atsVendor,
      mode: run.mode,
      fieldsDetected: run.fieldsDetected,
      fieldsFilled: run.fieldsFilled,
      fieldsSkipped: run.fieldsSkipped,
      createdAt: run.createdAt.toISOString(),
      snapshotTitle: run.snapshot?.title ?? null,
      jobTitle: run.application?.job.title ?? null,
      company: run.application?.job.company ?? null
    }))
  });
}
