import { PrismaClient } from "@prisma/client";

export const smokeSourceNames = [
  "__careerpilot_smoke_api_csv",
  "__careerpilot_smoke_backup_import",
  "__careerpilot_smoke_source_sync",
  "__careerpilot_smoke_visual_desktop",
  "__careerpilot_smoke_visual_mobile",
  "Smoke CSV Import",
  "source-import-desktop",
  "source-import-mobile"
];

export const smokeSourceUrls = [
  "https://example.com/__careerpilot-smoke-backup-job",
  "https://example.com/__careerpilot-smoke-csv-job",
  "https://example.com/__careerpilot-smoke-visual-csv",
  "https://example.com/smoke-csv-job",
  "https://example.com/visual-csv"
];

export const smokeFormUrls = [
  "https://example.com/__careerpilot-smoke-form/backup",
  "https://example.com/__careerpilot-smoke-form/workday"
];

export const smokeCompanies = ["Smoke Backup Tech", "Smoke CSV Tech", "Visual CSV Tech"];

export async function cleanupSmokeData() {
  const prisma = new PrismaClient();

  try {
    const sources = await prisma.jobSource.findMany({
      where: { name: { in: smokeSourceNames } },
      select: { id: true }
    });
    const sourceIds = sources.map((source) => source.id);

    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { sourceUrl: { in: smokeSourceUrls } },
          { company: { in: smokeCompanies } },
          ...(sourceIds.length ? [{ sourceId: { in: sourceIds } }] : [])
        ]
      },
      select: { id: true }
    });
    const jobIds = jobs.map((job) => job.id);

    const deletedJobs = jobIds.length ? await prisma.job.deleteMany({ where: { id: { in: jobIds } } }) : { count: 0 };
    const deletedAutofillRuns = await prisma.autofillRun.deleteMany({ where: { url: { in: smokeFormUrls } } });
    const deletedFormSnapshots = await prisma.formSnapshot.deleteMany({ where: { url: { in: smokeFormUrls } } });
    const deletedBatches = await prisma.jobImportBatch.deleteMany({
      where: {
        OR: [
          { sourceName: { in: smokeSourceNames } },
          ...(sourceIds.length ? [{ sourceId: { in: sourceIds } }] : [])
        ]
      }
    });
    const deletedSyncLogs = sourceIds.length ? await prisma.sourceSyncLog.deleteMany({ where: { sourceId: { in: sourceIds } } }) : { count: 0 };
    const deletedSources = await prisma.jobSource.deleteMany({ where: { name: { in: smokeSourceNames } } });

    return {
      ok: true,
      deleted: {
        jobs: deletedJobs.count,
        autofillRuns: deletedAutofillRuns.count,
        formSnapshots: deletedFormSnapshots.count,
        batches: deletedBatches.count,
        syncLogs: deletedSyncLogs.count,
        sources: deletedSources.count
      }
    };
  } finally {
    await prisma.$disconnect();
  }
}
