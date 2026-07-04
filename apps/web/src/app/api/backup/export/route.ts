import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET() {
  await ensureSeedData();

  const [
    profiles,
    jobSources,
    importBatches,
    jobs,
    applications,
    plans,
    answers,
    resumeAssets,
    resumes,
    materialDrafts,
    formSnapshots,
    mappingRules,
    autofillRuns,
    corrections,
    autofillContexts
  ] = await Promise.all([
    prisma.candidateProfile.findMany({ include: { fields: true } }),
    prisma.jobSource.findMany(),
    prisma.jobImportBatch.findMany(),
    prisma.job.findMany({ include: { parseResult: true } }),
    prisma.application.findMany(),
    prisma.dailyApplyPlan.findMany({ include: { tasks: { include: { package: true } } } }),
    prisma.answerVaultItem.findMany(),
    prisma.resumeAsset.findMany(),
    prisma.resumeVersion.findMany(),
    prisma.materialDraft.findMany(),
    prisma.formSnapshot.findMany({ include: { fields: true } }),
    prisma.fieldMappingRule.findMany(),
    prisma.autofillRun.findMany({ include: { snapshots: true } }),
    prisma.autofillCorrection.findMany(),
    prisma.autofillContext.findMany()
  ]);

  const payload = {
    product: "CareerPilot APAC",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      profiles: profiles.length,
      jobs: jobs.length,
      applications: applications.length,
      answers: answers.length,
      resumeAssets: resumeAssets.length,
      resumes: resumes.length,
      materialDrafts: materialDrafts.length,
      formSnapshots: formSnapshots.length,
      mappingRules: mappingRules.length,
      autofillRuns: autofillRuns.length,
      autofillContexts: autofillContexts.length
    },
    data: {
      profiles,
      jobSources,
      importBatches,
      jobs,
      applications,
      plans,
      answers,
      resumeAssets,
      resumes,
      materialDrafts,
      formSnapshots,
      mappingRules,
      autofillRuns,
      corrections,
      autofillContexts
    }
  };

  const fileDate = localDateKey(new Date());

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="careerpilot-apac-backup-${fileDate}.json"`
    }
  });
}
