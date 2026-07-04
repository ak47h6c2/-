import type { ApplicationStatus, MarketCode, Sensitivity, SourceType } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeMarket, normalizeSensitivity, normalizeStatus } from "./api-utils";

type Row = Record<string, unknown>;
type BackupData = Record<string, unknown>;

const sourceTypes = new Set(["MANUAL", "ADZUNA", "ATS", "EMAIL_ALERT", "COMPANY_SITE"]);

const countKeys = [
  "profiles",
  "profileFields",
  "jobSources",
  "importBatches",
  "jobs",
  "parseResults",
  "applications",
  "plans",
  "tasks",
  "taskPackages",
  "answers",
  "resumeAssets",
  "resumes",
  "materialDrafts",
  "formSnapshots",
  "formFields",
  "mappingRules",
  "autofillRuns",
  "runFieldSnapshots",
  "corrections",
  "autofillContexts"
] as const;

type CountKey = (typeof countKeys)[number];

export type BackupPreview = {
  ok: boolean;
  product: string | null;
  schemaVersion: number | null;
  exportedAt: string | null;
  mode: "merge";
  counts: Record<CountKey, number>;
  warnings: string[];
  errors: string[];
};

export type BackupImportResult = {
  ok: boolean;
  mode: "merge";
  preview: BackupPreview;
  imported: Record<CountKey, number>;
  skipped: Record<CountKey, number>;
};

function emptyCounts() {
  return Object.fromEntries(countKeys.map((key) => [key, 0])) as Record<CountKey, number>;
}

function isRow(value: unknown): value is Row {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function dataFromPayload(payload: Row): BackupData {
  return isRow(payload.data) ? payload.data : {};
}

function rowsFromData(data: BackupData, key: string): Row[] {
  const rows = data[key];
  return Array.isArray(rows) ? rows.filter(isRow) : [];
}

function nestedRows(row: Row, key: string): Row[] {
  const rows = row[key];
  return Array.isArray(rows) ? rows.filter(isRow) : [];
}

function nestedRow(row: Row, key: string): Row | null {
  return isRow(row[key]) ? row[key] : null;
}

function text(row: Row, key: string, fallback = "") {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function nullableText(row: Row, key: string) {
  const value = text(row, key).trim();
  return value.length ? value : null;
}

function idOf(row: Row) {
  const id = text(row, "id").trim();
  return id.length ? id : null;
}

function intValue(row: Row, key: string, fallback = 0) {
  const value = Number(row[key]);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function boolValue(row: Row, key: string, fallback = false) {
  const value = row[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function dateValue(row: Row, key: string, fallback = new Date()) {
  const raw = row[key];
  if (!raw) return fallback;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function nullableDate(row: Row, key: string) {
  const raw = row[key];
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sourceTypeValue(row: Row): SourceType {
  const value = text(row, "sourceType", "MANUAL").toUpperCase();
  return sourceTypes.has(value) ? (value as SourceType) : "MANUAL";
}

function jsonString(row: Row, key: string) {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function enumMarket(row: Row, key = "market", fallback: MarketCode = "GLOBAL") {
  return normalizeMarket(row[key], fallback);
}

function enumSensitivity(row: Row, key = "sensitivity", fallback: Sensitivity = "REVIEW") {
  return normalizeSensitivity(row[key], fallback);
}

function enumStatus(row: Row, key = "status", fallback: ApplicationStatus = "SAVED") {
  return normalizeStatus(row[key], fallback);
}

function optionalId(value: unknown, allowed: Set<string>) {
  const id = typeof value === "string" ? value.trim() : "";
  return id && allowed.has(id) ? id : null;
}

function addId(set: Set<string>, value: string | null) {
  if (value) set.add(value);
}

function collectRows(payload: Row) {
  const data = dataFromPayload(payload);
  const profiles = rowsFromData(data, "profiles");
  const jobs = rowsFromData(data, "jobs");
  const plans = rowsFromData(data, "plans");
  const formSnapshots = rowsFromData(data, "formSnapshots");
  const autofillRuns = rowsFromData(data, "autofillRuns");

  return {
    profiles,
    profileFields: profiles.flatMap((profile) => nestedRows(profile, "fields")),
    jobSources: rowsFromData(data, "jobSources"),
    importBatches: rowsFromData(data, "importBatches"),
    jobs,
    parseResults: jobs.map((job) => nestedRow(job, "parseResult")).filter(isRow),
    applications: rowsFromData(data, "applications"),
    plans,
    tasks: plans.flatMap((plan) => nestedRows(plan, "tasks")),
    taskPackages: plans.flatMap((plan) => nestedRows(plan, "tasks").map((task) => nestedRow(task, "package")).filter(isRow)),
    answers: rowsFromData(data, "answers"),
    resumeAssets: rowsFromData(data, "resumeAssets"),
    resumes: rowsFromData(data, "resumes"),
    materialDrafts: rowsFromData(data, "materialDrafts"),
    formSnapshots,
    formFields: formSnapshots.flatMap((snapshot) => nestedRows(snapshot, "fields")),
    mappingRules: rowsFromData(data, "mappingRules"),
    autofillRuns,
    runFieldSnapshots: autofillRuns.flatMap((run) => nestedRows(run, "snapshots")),
    corrections: rowsFromData(data, "corrections"),
    autofillContexts: rowsFromData(data, "autofillContexts")
  };
}

export function summarizeBackupPayload(input: unknown): BackupPreview {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRow(input)) {
    return {
      ok: false,
      product: null,
      schemaVersion: null,
      exportedAt: null,
      mode: "merge",
      counts: emptyCounts(),
      warnings,
      errors: ["备份文件不是有效 JSON 对象"]
    };
  }

  const product = nullableText(input, "product");
  const schemaVersion = Number.isFinite(Number(input.schemaVersion)) ? Number(input.schemaVersion) : null;
  const exportedAt = nullableText(input, "exportedAt");
  const data = dataFromPayload(input);
  const collected = collectRows(input);
  const counts = emptyCounts();

  for (const key of countKeys) {
    counts[key] = collected[key].length;
  }

  if (product !== "CareerPilot APAC") warnings.push("产品名不是 CareerPilot APAC，会按兼容格式尝试读取。");
  if (schemaVersion !== 1) warnings.push("备份 schemaVersion 不是 1，会按当前本地格式做保守导入。");
  if (!isRow(input.data)) errors.push("备份文件缺少 data 对象。");
  if (Object.keys(data).length === 0) errors.push("备份文件没有可导入的数据。");

  const missingIds = countKeys
    .filter((key) => collected[key].some((row) => !idOf(row)))
    .map((key) => key);

  if (missingIds.length) {
    warnings.push(`部分记录缺少 id，导入时会跳过：${missingIds.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    product,
    schemaVersion,
    exportedAt,
    mode: "merge",
    counts,
    warnings,
    errors
  };
}

async function existingIds<T extends { id: string }>(rows: Promise<T[]>) {
  return new Set((await rows).map((row) => row.id));
}

function bump(counter: Record<CountKey, number>, key: CountKey) {
  counter[key] += 1;
}

function skip(counter: Record<CountKey, number>, key: CountKey) {
  counter[key] += 1;
}

export async function importBackupPayload(input: unknown): Promise<BackupImportResult> {
  const preview = summarizeBackupPayload(input);
  const imported = emptyCounts();
  const skipped = emptyCounts();

  if (!preview.ok || !isRow(input)) {
    return { ok: false, mode: "merge", preview, imported, skipped };
  }

  const collected = collectRows(input);

  await prisma.$transaction(async (tx) => {
    const sourceIds = await existingIds(tx.jobSource.findMany({ select: { id: true } }));
    const batchIds = await existingIds(tx.jobImportBatch.findMany({ select: { id: true } }));
    const jobIds = await existingIds(tx.job.findMany({ select: { id: true } }));
    const profileIds = await existingIds(tx.candidateProfile.findMany({ select: { id: true } }));
    const fieldIds = await existingIds(tx.candidateProfileField.findMany({ select: { id: true } }));
    const resumeAssetIds = await existingIds(tx.resumeAsset.findMany({ select: { id: true } }));
    const resumeVersionIds = await existingIds(tx.resumeVersion.findMany({ select: { id: true } }));
    const applicationIds = await existingIds(tx.application.findMany({ select: { id: true } }));
    const planIds = await existingIds(tx.dailyApplyPlan.findMany({ select: { id: true } }));
    const taskIds = await existingIds(tx.applyTask.findMany({ select: { id: true } }));
    const snapshotIds = await existingIds(tx.formSnapshot.findMany({ select: { id: true } }));
    const formFieldIds = await existingIds(tx.formField.findMany({ select: { id: true } }));
    const mappingRuleIds = await existingIds(tx.fieldMappingRule.findMany({ select: { id: true } }));
    const runIds = await existingIds(tx.autofillRun.findMany({ select: { id: true } }));

    for (const row of collected.profiles) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "profiles");
        continue;
      }
      await tx.candidateProfile.upsert({
        where: { id },
        update: {
          name: text(row, "name", "我的求职资料"),
          headline: nullableText(row, "headline"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          name: text(row, "name", "我的求职资料"),
          headline: nullableText(row, "headline"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(profileIds, id);
      bump(imported, "profiles");
    }

    for (const profile of collected.profiles) {
      const profileId = idOf(profile);
      if (!profileId || !profileIds.has(profileId)) continue;
      for (const row of nestedRows(profile, "fields")) {
        const id = idOf(row);
        if (!id) {
          skip(skipped, "profileFields");
          continue;
        }
        await tx.candidateProfileField.upsert({
          where: { id },
          update: {
            profileId,
            key: text(row, "key", "customField"),
            label: text(row, "label", "自定义字段"),
            value: text(row, "value"),
            market: row.market ? enumMarket(row) : null,
            sensitivity: enumSensitivity(row),
            updatedAt: dateValue(row, "updatedAt")
          },
          create: {
            id,
            profileId,
            key: text(row, "key", "customField"),
            label: text(row, "label", "自定义字段"),
            value: text(row, "value"),
            market: row.market ? enumMarket(row) : null,
            sensitivity: enumSensitivity(row),
            createdAt: dateValue(row, "createdAt"),
            updatedAt: dateValue(row, "updatedAt")
          }
        });
        addId(fieldIds, id);
        bump(imported, "profileFields");
      }
    }

    for (const row of collected.jobSources) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "jobSources");
        continue;
      }
      await tx.jobSource.upsert({
        where: { id },
        update: {
          name: text(row, "name", "导入来源"),
          market: enumMarket(row),
          sourceType: sourceTypeValue(row),
          baseUrl: nullableText(row, "baseUrl"),
          enabled: boolValue(row, "enabled", true),
          reliability: intValue(row, "reliability", 70),
          lastSyncedAt: nullableDate(row, "lastSyncedAt")
        },
        create: {
          id,
          name: text(row, "name", "导入来源"),
          market: enumMarket(row),
          sourceType: sourceTypeValue(row),
          baseUrl: nullableText(row, "baseUrl"),
          enabled: boolValue(row, "enabled", true),
          reliability: intValue(row, "reliability", 70),
          lastSyncedAt: nullableDate(row, "lastSyncedAt"),
          createdAt: dateValue(row, "createdAt")
        }
      });
      addId(sourceIds, id);
      bump(imported, "jobSources");
    }

    for (const row of collected.importBatches) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "importBatches");
        continue;
      }
      await tx.jobImportBatch.upsert({
        where: { id },
        update: {
          sourceId: optionalId(row.sourceId, sourceIds),
          sourceName: text(row, "sourceName", "备份导入"),
          importType: text(row, "importType", "backup"),
          rawText: nullableText(row, "rawText"),
          issuesJson: nullableText(row, "issuesJson"),
          totalCount: intValue(row, "totalCount"),
          importedCount: intValue(row, "importedCount"),
          dedupedCount: intValue(row, "dedupedCount"),
          skippedCount: intValue(row, "skippedCount"),
          errorCount: intValue(row, "errorCount")
        },
        create: {
          id,
          sourceId: optionalId(row.sourceId, sourceIds),
          sourceName: text(row, "sourceName", "备份导入"),
          importType: text(row, "importType", "backup"),
          rawText: nullableText(row, "rawText"),
          issuesJson: nullableText(row, "issuesJson"),
          totalCount: intValue(row, "totalCount"),
          importedCount: intValue(row, "importedCount"),
          dedupedCount: intValue(row, "dedupedCount"),
          skippedCount: intValue(row, "skippedCount"),
          errorCount: intValue(row, "errorCount"),
          createdAt: dateValue(row, "createdAt")
        }
      });
      addId(batchIds, id);
      bump(imported, "importBatches");
    }

    for (const row of collected.jobs) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "jobs");
        continue;
      }
      await tx.job.upsert({
        where: { id },
        update: {
          sourceId: optionalId(row.sourceId, sourceIds),
          importBatchId: optionalId(row.importBatchId, batchIds),
          market: enumMarket(row),
          title: text(row, "title", "未命名岗位"),
          company: text(row, "company", "未知公司"),
          location: nullableText(row, "location"),
          sourceUrl: nullableText(row, "sourceUrl"),
          description: text(row, "description"),
          language: text(row, "language", "en"),
          postedAt: nullableDate(row, "postedAt"),
          firstSeenAt: dateValue(row, "firstSeenAt"),
          lastSeenAt: dateValue(row, "lastSeenAt"),
          matchScore: row.matchScore === null ? null : intValue(row, "matchScore", 50),
          visaRisk: nullableText(row, "visaRisk"),
          graduateFit: nullableText(row, "graduateFit"),
          archived: boolValue(row, "archived"),
          sourceHash: nullableText(row, "sourceHash"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          sourceId: optionalId(row.sourceId, sourceIds),
          importBatchId: optionalId(row.importBatchId, batchIds),
          market: enumMarket(row),
          title: text(row, "title", "未命名岗位"),
          company: text(row, "company", "未知公司"),
          location: nullableText(row, "location"),
          sourceUrl: nullableText(row, "sourceUrl"),
          description: text(row, "description"),
          language: text(row, "language", "en"),
          postedAt: nullableDate(row, "postedAt"),
          firstSeenAt: dateValue(row, "firstSeenAt"),
          lastSeenAt: dateValue(row, "lastSeenAt"),
          matchScore: row.matchScore === null ? null : intValue(row, "matchScore", 50),
          visaRisk: nullableText(row, "visaRisk"),
          graduateFit: nullableText(row, "graduateFit"),
          archived: boolValue(row, "archived"),
          sourceHash: nullableText(row, "sourceHash"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(jobIds, id);
      bump(imported, "jobs");
    }

    for (const job of collected.jobs) {
      const jobId = idOf(job);
      const row = nestedRow(job, "parseResult");
      if (!jobId || !row || !jobIds.has(jobId)) continue;
      const id = idOf(row);
      if (!id) {
        skip(skipped, "parseResults");
        continue;
      }
      await tx.jobParseResult.upsert({
        where: { jobId },
        update: {
          rawText: nullableText(row, "rawText"),
          keywordsJson: jsonString(row, "keywordsJson"),
          positiveReasonsJson: jsonString(row, "positiveReasonsJson"),
          negativeReasonsJson: jsonString(row, "negativeReasonsJson"),
          riskSignalsJson: jsonString(row, "riskSignalsJson"),
          deadline: nullableDate(row, "deadline"),
          confidence: intValue(row, "confidence", 70),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          jobId,
          rawText: nullableText(row, "rawText"),
          keywordsJson: jsonString(row, "keywordsJson"),
          positiveReasonsJson: jsonString(row, "positiveReasonsJson"),
          negativeReasonsJson: jsonString(row, "negativeReasonsJson"),
          riskSignalsJson: jsonString(row, "riskSignalsJson"),
          deadline: nullableDate(row, "deadline"),
          confidence: intValue(row, "confidence", 70),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      bump(imported, "parseResults");
    }

    for (const row of collected.resumeAssets) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "resumeAssets");
        continue;
      }
      await tx.resumeAsset.upsert({
        where: { id },
        update: {
          name: text(row, "name", "简历文件"),
          market: row.market ? enumMarket(row) : null,
          roleFamily: text(row, "roleFamily", "General"),
          filePath: nullableText(row, "filePath"),
          content: nullableText(row, "content"),
          version: intValue(row, "version", 1),
          isActive: boolValue(row, "isActive", true),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          name: text(row, "name", "简历文件"),
          market: row.market ? enumMarket(row) : null,
          roleFamily: text(row, "roleFamily", "General"),
          filePath: nullableText(row, "filePath"),
          content: nullableText(row, "content"),
          version: intValue(row, "version", 1),
          isActive: boolValue(row, "isActive", true),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(resumeAssetIds, id);
      bump(imported, "resumeAssets");
    }

    for (const row of collected.resumes) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "resumes");
        continue;
      }
      await tx.resumeVersion.upsert({
        where: { id },
        update: {
          name: text(row, "name", "简历版本"),
          market: row.market ? enumMarket(row) : null,
          roleFamily: text(row, "roleFamily", "General"),
          language: text(row, "language", "zh"),
          content: text(row, "content"),
          isDefault: boolValue(row, "isDefault"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          name: text(row, "name", "简历版本"),
          market: row.market ? enumMarket(row) : null,
          roleFamily: text(row, "roleFamily", "General"),
          language: text(row, "language", "zh"),
          content: text(row, "content"),
          isDefault: boolValue(row, "isDefault"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(resumeVersionIds, id);
      bump(imported, "resumes");
    }

    for (const row of collected.applications) {
      const id = idOf(row);
      const jobId = optionalId(row.jobId, jobIds);
      if (!id || !jobId) {
        skip(skipped, "applications");
        continue;
      }
      await tx.application.upsert({
        where: { id },
        update: {
          jobId,
          resumeId: optionalId(row.resumeId, resumeAssetIds),
          status: enumStatus(row),
          appliedAt: nullableDate(row, "appliedAt"),
          responseAt: nullableDate(row, "responseAt"),
          nextAction: nullableText(row, "nextAction"),
          nextActionAt: nullableDate(row, "nextActionAt"),
          notes: nullableText(row, "notes"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          jobId,
          resumeId: optionalId(row.resumeId, resumeAssetIds),
          status: enumStatus(row),
          appliedAt: nullableDate(row, "appliedAt"),
          responseAt: nullableDate(row, "responseAt"),
          nextAction: nullableText(row, "nextAction"),
          nextActionAt: nullableDate(row, "nextActionAt"),
          notes: nullableText(row, "notes"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(applicationIds, id);
      bump(imported, "applications");
    }

    for (const row of collected.plans) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "plans");
        continue;
      }
      await tx.dailyApplyPlan.upsert({
        where: { id },
        update: {
          planDate: dateValue(row, "planDate"),
          targetCount: intValue(row, "targetCount", 5),
          status: text(row, "status", "pending"),
          generatedAt: dateValue(row, "generatedAt"),
          completedAt: nullableDate(row, "completedAt")
        },
        create: {
          id,
          planDate: dateValue(row, "planDate"),
          targetCount: intValue(row, "targetCount", 5),
          status: text(row, "status", "pending"),
          generatedAt: dateValue(row, "generatedAt"),
          completedAt: nullableDate(row, "completedAt")
        }
      });
      addId(planIds, id);
      bump(imported, "plans");
    }

    for (const plan of collected.plans) {
      const planId = idOf(plan);
      if (!planId || !planIds.has(planId)) continue;
      for (const row of nestedRows(plan, "tasks")) {
        const id = idOf(row);
        const jobId = optionalId(row.jobId, jobIds);
        if (!id || !jobId) {
          skip(skipped, "tasks");
          continue;
        }
        await tx.applyTask.upsert({
          where: { id },
          update: {
            planId,
            jobId,
            priority: intValue(row, "priority", 50),
            status: text(row, "status", "queued"),
            matchScore: row.matchScore === null ? null : intValue(row, "matchScore", 50),
            riskLevel: nullableText(row, "riskLevel"),
            skipReason: nullableText(row, "skipReason"),
            updatedAt: dateValue(row, "updatedAt")
          },
          create: {
            id,
            planId,
            jobId,
            priority: intValue(row, "priority", 50),
            status: text(row, "status", "queued"),
            matchScore: row.matchScore === null ? null : intValue(row, "matchScore", 50),
            riskLevel: nullableText(row, "riskLevel"),
            skipReason: nullableText(row, "skipReason"),
            createdAt: dateValue(row, "createdAt"),
            updatedAt: dateValue(row, "updatedAt")
          }
        });
        addId(taskIds, id);
        bump(imported, "tasks");
      }
    }

    for (const plan of collected.plans) {
      for (const task of nestedRows(plan, "tasks")) {
        const applyTaskId = idOf(task);
        const row = nestedRow(task, "package");
        if (!row) continue;
        const id = idOf(row);
        if (!id || !applyTaskId || !taskIds.has(applyTaskId)) {
          skip(skipped, "taskPackages");
          continue;
        }
        await tx.applicationPackage.upsert({
          where: { id },
          update: {
            applyTaskId,
            coverLetterDraft: nullableText(row, "coverLetterDraft"),
            screenerAnswersJson: nullableText(row, "screenerAnswersJson"),
            checklistJson: nullableText(row, "checklistJson"),
            generatedAt: dateValue(row, "generatedAt")
          },
          create: {
            id,
            applyTaskId,
            coverLetterDraft: nullableText(row, "coverLetterDraft"),
            screenerAnswersJson: nullableText(row, "screenerAnswersJson"),
            checklistJson: nullableText(row, "checklistJson"),
            generatedAt: dateValue(row, "generatedAt")
          }
        });
        bump(imported, "taskPackages");
      }
    }

    for (const row of collected.answers) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "answers");
        continue;
      }
      await tx.answerVaultItem.upsert({
        where: { id },
        update: {
          question: text(row, "question", "未命名问题"),
          answer: text(row, "answer"),
          market: row.market ? enumMarket(row) : null,
          roleFamily: nullableText(row, "roleFamily"),
          sensitivity: enumSensitivity(row),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          question: text(row, "question", "未命名问题"),
          answer: text(row, "answer"),
          market: row.market ? enumMarket(row) : null,
          roleFamily: nullableText(row, "roleFamily"),
          sensitivity: enumSensitivity(row),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      bump(imported, "answers");
    }

    for (const row of collected.materialDrafts) {
      const id = idOf(row);
      const jobId = optionalId(row.jobId, jobIds);
      if (!id || !jobId) {
        skip(skipped, "materialDrafts");
        continue;
      }
      await tx.materialDraft.upsert({
        where: { id },
        update: {
          jobId,
          resumeVersionId: optionalId(row.resumeVersionId, resumeVersionIds),
          draftType: text(row, "draftType", "note"),
          title: text(row, "title", "材料草稿"),
          content: text(row, "content"),
          status: text(row, "status", "draft"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          jobId,
          resumeVersionId: optionalId(row.resumeVersionId, resumeVersionIds),
          draftType: text(row, "draftType", "note"),
          title: text(row, "title", "材料草稿"),
          content: text(row, "content"),
          status: text(row, "status", "draft"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      bump(imported, "materialDrafts");
    }

    for (const row of collected.formSnapshots) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "formSnapshots");
        continue;
      }
      await tx.formSnapshot.upsert({
        where: { id },
        update: {
          applicationId: optionalId(row.applicationId, applicationIds),
          url: text(row, "url"),
          host: nullableText(row, "host"),
          title: nullableText(row, "title"),
          atsVendor: nullableText(row, "atsVendor"),
          source: text(row, "source", "EDGE"),
          fieldCount: intValue(row, "fieldCount"),
          safeCount: intValue(row, "safeCount"),
          reviewCount: intValue(row, "reviewCount"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          applicationId: optionalId(row.applicationId, applicationIds),
          url: text(row, "url"),
          host: nullableText(row, "host"),
          title: nullableText(row, "title"),
          atsVendor: nullableText(row, "atsVendor"),
          source: text(row, "source", "EDGE"),
          fieldCount: intValue(row, "fieldCount"),
          safeCount: intValue(row, "safeCount"),
          reviewCount: intValue(row, "reviewCount"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(snapshotIds, id);
      bump(imported, "formSnapshots");
    }

    for (const snapshot of collected.formSnapshots) {
      const snapshotId = idOf(snapshot);
      if (!snapshotId || !snapshotIds.has(snapshotId)) continue;
      for (const row of nestedRows(snapshot, "fields")) {
        const id = idOf(row);
        if (!id) {
          skip(skipped, "formFields");
          continue;
        }
        await tx.formField.upsert({
          where: { id },
          update: {
            snapshotId,
            fieldFingerprint: text(row, "fieldFingerprint", id),
            label: text(row, "label", "未命名字段"),
            inputName: nullableText(row, "inputName"),
            inputId: nullableText(row, "inputId"),
            inputType: nullableText(row, "inputType"),
            placeholder: nullableText(row, "placeholder"),
            required: boolValue(row, "required"),
            detectedKey: nullableText(row, "detectedKey"),
            mappedKey: nullableText(row, "mappedKey"),
            sensitivity: enumSensitivity(row),
            confidence: intValue(row, "confidence"),
            selector: nullableText(row, "selector"),
            optionsJson: nullableText(row, "optionsJson"),
            updatedAt: dateValue(row, "updatedAt")
          },
          create: {
            id,
            snapshotId,
            fieldFingerprint: text(row, "fieldFingerprint", id),
            label: text(row, "label", "未命名字段"),
            inputName: nullableText(row, "inputName"),
            inputId: nullableText(row, "inputId"),
            inputType: nullableText(row, "inputType"),
            placeholder: nullableText(row, "placeholder"),
            required: boolValue(row, "required"),
            detectedKey: nullableText(row, "detectedKey"),
            mappedKey: nullableText(row, "mappedKey"),
            sensitivity: enumSensitivity(row),
            confidence: intValue(row, "confidence"),
            selector: nullableText(row, "selector"),
            optionsJson: nullableText(row, "optionsJson"),
            createdAt: dateValue(row, "createdAt"),
            updatedAt: dateValue(row, "updatedAt")
          }
        });
        addId(formFieldIds, id);
        bump(imported, "formFields");
      }
    }

    for (const row of collected.mappingRules) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "mappingRules");
        continue;
      }
      await tx.fieldMappingRule.upsert({
        where: { id },
        update: {
          formFieldId: optionalId(row.formFieldId, formFieldIds),
          host: nullableText(row, "host"),
          atsVendor: nullableText(row, "atsVendor"),
          fieldFingerprint: nullableText(row, "fieldFingerprint"),
          labelPattern: text(row, "labelPattern", ""),
          inputName: nullableText(row, "inputName"),
          candidateKey: text(row, "candidateKey", ""),
          sensitivity: enumSensitivity(row, "sensitivity", "SAFE"),
          confidence: intValue(row, "confidence", 90),
          enabled: boolValue(row, "enabled", true),
          source: text(row, "source", "backup"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          formFieldId: optionalId(row.formFieldId, formFieldIds),
          host: nullableText(row, "host"),
          atsVendor: nullableText(row, "atsVendor"),
          fieldFingerprint: nullableText(row, "fieldFingerprint"),
          labelPattern: text(row, "labelPattern", ""),
          inputName: nullableText(row, "inputName"),
          candidateKey: text(row, "candidateKey", ""),
          sensitivity: enumSensitivity(row, "sensitivity", "SAFE"),
          confidence: intValue(row, "confidence", 90),
          enabled: boolValue(row, "enabled", true),
          source: text(row, "source", "backup"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      addId(mappingRuleIds, id);
      bump(imported, "mappingRules");
    }

    for (const row of collected.autofillRuns) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "autofillRuns");
        continue;
      }
      await tx.autofillRun.upsert({
        where: { id },
        update: {
          applicationId: optionalId(row.applicationId, applicationIds),
          snapshotId: optionalId(row.snapshotId, snapshotIds),
          url: text(row, "url"),
          atsVendor: nullableText(row, "atsVendor"),
          mode: text(row, "mode", "scan"),
          fieldsDetected: intValue(row, "fieldsDetected"),
          fieldsFilled: intValue(row, "fieldsFilled"),
          fieldsSkipped: intValue(row, "fieldsSkipped")
        },
        create: {
          id,
          applicationId: optionalId(row.applicationId, applicationIds),
          snapshotId: optionalId(row.snapshotId, snapshotIds),
          url: text(row, "url"),
          atsVendor: nullableText(row, "atsVendor"),
          mode: text(row, "mode", "scan"),
          fieldsDetected: intValue(row, "fieldsDetected"),
          fieldsFilled: intValue(row, "fieldsFilled"),
          fieldsSkipped: intValue(row, "fieldsSkipped"),
          createdAt: dateValue(row, "createdAt")
        }
      });
      addId(runIds, id);
      bump(imported, "autofillRuns");
    }

    for (const run of collected.autofillRuns) {
      const autofillRunId = idOf(run);
      if (!autofillRunId || !runIds.has(autofillRunId)) continue;
      for (const row of nestedRows(run, "snapshots")) {
        const id = idOf(row);
        if (!id) {
          skip(skipped, "runFieldSnapshots");
          continue;
        }
        await tx.formFieldSnapshot.upsert({
          where: { id },
          update: {
            autofillRunId,
            url: text(row, "url"),
            label: text(row, "label", "未命名字段"),
            inputName: nullableText(row, "inputName"),
            inputType: nullableText(row, "inputType"),
            detectedKey: nullableText(row, "detectedKey"),
            confidence: intValue(row, "confidence")
          },
          create: {
            id,
            autofillRunId,
            url: text(row, "url"),
            label: text(row, "label", "未命名字段"),
            inputName: nullableText(row, "inputName"),
            inputType: nullableText(row, "inputType"),
            detectedKey: nullableText(row, "detectedKey"),
            confidence: intValue(row, "confidence"),
            createdAt: dateValue(row, "createdAt")
          }
        });
        bump(imported, "runFieldSnapshots");
      }
    }

    for (const row of collected.corrections) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "corrections");
        continue;
      }
      await tx.autofillCorrection.upsert({
        where: { id },
        update: {
          runId: optionalId(row.runId, runIds),
          formFieldId: optionalId(row.formFieldId, formFieldIds),
          mappingRuleId: optionalId(row.mappingRuleId, mappingRuleIds),
          previousKey: nullableText(row, "previousKey"),
          correctedKey: text(row, "correctedKey"),
          note: nullableText(row, "note")
        },
        create: {
          id,
          runId: optionalId(row.runId, runIds),
          formFieldId: optionalId(row.formFieldId, formFieldIds),
          mappingRuleId: optionalId(row.mappingRuleId, mappingRuleIds),
          previousKey: nullableText(row, "previousKey"),
          correctedKey: text(row, "correctedKey"),
          note: nullableText(row, "note"),
          createdAt: dateValue(row, "createdAt")
        }
      });
      bump(imported, "corrections");
    }

    for (const row of collected.autofillContexts) {
      const id = idOf(row);
      if (!id) {
        skip(skipped, "autofillContexts");
        continue;
      }
      await tx.autofillContext.upsert({
        where: { id },
        update: {
          applicationId: optionalId(row.applicationId, applicationIds),
          jobId: optionalId(row.jobId, jobIds),
          urlHint: nullableText(row, "urlHint"),
          hostHint: nullableText(row, "hostHint"),
          status: text(row, "status", "active"),
          expiresAt: nullableDate(row, "expiresAt"),
          updatedAt: dateValue(row, "updatedAt")
        },
        create: {
          id,
          applicationId: optionalId(row.applicationId, applicationIds),
          jobId: optionalId(row.jobId, jobIds),
          urlHint: nullableText(row, "urlHint"),
          hostHint: nullableText(row, "hostHint"),
          status: text(row, "status", "active"),
          expiresAt: nullableDate(row, "expiresAt"),
          createdAt: dateValue(row, "createdAt"),
          updatedAt: dateValue(row, "updatedAt")
        }
      });
      bump(imported, "autofillContexts");
    }
  });

  return { ok: true, mode: "merge", preview, imported, skipped };
}
