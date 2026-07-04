import { cleanupSmokeData } from "./smoke-artifacts.mjs";

const baseUrl = process.env.CAREERPILOT_WEB_URL || "http://localhost:3000";
const smokeCsvSourceName = "__careerpilot_smoke_api_csv";
const smokeBackupSourceName = "__careerpilot_smoke_backup_import";
const smokeSyncSourceName = "__careerpilot_smoke_source_sync";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildBackupImportSmokePayload() {
  const now = new Date().toISOString();

  return {
    product: "CareerPilot APAC",
    schemaVersion: 1,
    exportedAt: now,
    data: {
      jobSources: [
        {
          id: "__careerpilot_smoke_backup_source",
          name: smokeBackupSourceName,
          market: "SG",
          sourceType: "MANUAL",
          baseUrl: "https://example.com/__careerpilot-smoke-backup-source",
          enabled: true,
          reliability: 65,
          createdAt: now
        }
      ],
      jobs: [
        {
          id: "__careerpilot_smoke_backup_job",
          sourceId: "__careerpilot_smoke_backup_source",
          market: "SG",
          title: "Backup Restore Engineer Intern",
          company: "Smoke Backup Tech",
          location: "Singapore",
          sourceUrl: "https://example.com/__careerpilot-smoke-backup-job",
          description: "Smoke backup import role for verifying merge restore, application links, and form snapshots.",
          language: "en",
          postedAt: now,
          firstSeenAt: now,
          lastSeenAt: now,
          matchScore: 76,
          visaRisk: "LOW",
          graduateFit: "实习/校招友好",
          archived: false,
          sourceHash: "__careerpilot_smoke_backup_hash",
          createdAt: now,
          updatedAt: now,
          parseResult: {
            id: "__careerpilot_smoke_backup_parse",
            rawText: "Backup Restore Engineer Intern, Singapore, graduate friendly",
            keywordsJson: JSON.stringify(["backup", "restore", "internship"]),
            positiveReasonsJson: JSON.stringify(["验证备份恢复能导入岗位解析结果"]),
            negativeReasonsJson: JSON.stringify([]),
            riskSignalsJson: JSON.stringify([]),
            confidence: 88,
            createdAt: now,
            updatedAt: now
          }
        }
      ],
      applications: [
        {
          id: "__careerpilot_smoke_backup_application",
          jobId: "__careerpilot_smoke_backup_job",
          status: "PREPARED",
          nextAction: "验证备份恢复后仍能绑定投递记录",
          nextActionAt: now,
          notes: "Smoke backup import application",
          createdAt: now,
          updatedAt: now
        }
      ],
      formSnapshots: [
        {
          id: "__careerpilot_smoke_backup_snapshot",
          applicationId: "__careerpilot_smoke_backup_application",
          url: "https://example.com/__careerpilot-smoke-form/backup",
          host: "example.com",
          title: "Smoke Backup Form",
          atsVendor: "通用表单",
          source: "EDGE",
          fieldCount: 2,
          safeCount: 1,
          reviewCount: 1,
          createdAt: now,
          updatedAt: now,
          fields: [
            {
              id: "__careerpilot_smoke_backup_field_name",
              fieldFingerprint: "__careerpilot_smoke_backup_field_name",
              label: "Full name",
              inputName: "full_name",
              inputId: "full_name",
              inputType: "text",
              placeholder: "Full name",
              required: true,
              detectedKey: "fullName",
              mappedKey: "fullName",
              sensitivity: "SAFE",
              confidence: 95,
              createdAt: now,
              updatedAt: now
            },
            {
              id: "__careerpilot_smoke_backup_field_salary",
              fieldFingerprint: "__careerpilot_smoke_backup_field_salary",
              label: "Expected salary",
              inputName: "salary",
              inputId: "salary",
              inputType: "text",
              placeholder: "Expected salary",
              required: false,
              detectedKey: "salaryExpectation",
              mappedKey: "salaryExpectation",
              sensitivity: "REVIEW",
              confidence: 72,
              createdAt: now,
              updatedAt: now
            }
          ]
        }
      ]
    }
  };
}

async function requestJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const health = await requestJson("/api/health/text-encoding");
  assert(health.ok === true, "text encoding health must be ok");

  const profile = await requestJson("/api/profile");
  assert(profile.profile?.id, "profile must include an id");
  assert(Array.isArray(profile.profile.fields), "profile fields must be an array");

  const autofillProfile = await requestJson("/api/autofill/profile");
  assert(Array.isArray(autofillProfile.profile), "autofill profile must expose a profile array");
  assert(autofillProfile.profile.every((field) => field.sensitivity !== "sensitive"), "autofill profile must not expose sensitive fields for filling");

  const atsRules = await requestJson("/api/autofill/ats-rules");
  const atsVendors = new Set((atsRules.vendors || []).map((vendor) => vendor.vendor));
  const atsCandidateKeys = new Set((atsRules.vendors || []).flatMap((vendor) => vendor.candidateKeys || []));
  assert(atsVendors.has("Ashby"), "ATS rules must include Ashby");
  assert(atsVendors.has("BambooHR"), "ATS rules must include BambooHR");
  assert(atsCandidateKeys.has("wechatId"), "ATS rules must recognize WeChat fields");
  assert(atsCandidateKeys.has("sourceChannel"), "ATS rules must recognize application source fields");
  assert(atsCandidateKeys.has("dateOfBirth"), "ATS rules must recognize date-of-birth fields as sensitive");

  const jobs = await requestJson("/api/jobs");
  assert(Array.isArray(jobs.jobs), "jobs endpoint must return a jobs array");
  if (jobs.jobs[0]?.id) {
    const updatedJob = await requestJson("/api/jobs", {
      method: "PATCH",
      body: JSON.stringify({
        id: jobs.jobs[0].id,
        market: jobs.jobs[0].market,
        company: jobs.jobs[0].company,
        title: jobs.jobs[0].title,
        location: jobs.jobs[0].location,
        sourceUrl: jobs.jobs[0].sourceUrl,
        description: jobs.jobs[0].description,
        matchScore: jobs.jobs[0].matchScore,
        visaRisk: jobs.jobs[0].visaRisk,
        graduateFit: jobs.jobs[0].graduateFit
      })
    });
    assert(updatedJob.job?.id === jobs.jobs[0].id, "jobs PATCH must return the updated job");
    assert("archived" in updatedJob.job, "jobs PATCH must expose archived flag");
  }

  const applications = await requestJson("/api/applications");
  assert(Array.isArray(applications.applications), "applications endpoint must return an applications array");
  if (applications.applications[0]) {
    assert("nextAction" in applications.applications[0], "applications endpoint must expose nextAction");
    assert("nextActionAt" in applications.applications[0], "applications endpoint must expose nextActionAt");
  }

  const answers = await requestJson("/api/answer-vault");
  assert(Array.isArray(answers.items), "answer vault endpoint must return items");
  if (answers.items[0]) {
    assert("sensitivity" in answers.items[0], "answer vault endpoint must expose sensitivity");
    assert("roleFamily" in answers.items[0], "answer vault endpoint must expose role family");
  }

  const plan = await requestJson("/api/daily-sprint/plan");
  assert("plan" in plan, "daily plan endpoint must return a plan key");

  const sources = await requestJson("/api/job-sources");
  assert(Array.isArray(sources.sources), "job sources endpoint must return sources");
  if (sources.sources[0]) {
    assert("enabled" in sources.sources[0], "job sources endpoint must expose enabled flag");
    assert(typeof sources.sources[0].reliability === "number", "job sources endpoint must expose reliability");
  }

  const batches = await requestJson("/api/import-batches");
  assert(Array.isArray(batches.batches), "import batches endpoint must return batches");

  const resumes = await requestJson("/api/resumes");
  assert(Array.isArray(resumes.resumes), "resumes endpoint must return resumes");
  if (resumes.resumes[0]) {
    assert(typeof resumes.resumes[0].content === "string", "resumes endpoint must include editable content");
    assert("isDefault" in resumes.resumes[0], "resumes endpoint must expose default flag");
  }

  const materials = await requestJson("/api/materials");
  assert(Array.isArray(materials.drafts), "materials endpoint must return drafts");
  if (materials.drafts[0]?.id) {
    const materialDetail = await requestJson(`/api/materials/${materials.drafts[0].id}`);
    assert(materialDetail.draft?.id === materials.drafts[0].id, "material detail endpoint must return the requested draft");
    assert(typeof materialDetail.draft.content === "string", "material detail endpoint must include editable content");
  }

  const snapshots = await requestJson("/api/autofill/snapshots");
  assert(Array.isArray(snapshots.snapshots), "snapshots endpoint must return snapshots");

  const runs = await requestJson("/api/autofill/runs");
  assert(Array.isArray(runs.runs), "autofill runs endpoint must return runs");

  const autofillContext = await requestJson(`/api/autofill/context?url=${encodeURIComponent(`${baseUrl}/ats-lab?type=workday`)}`);
  assert("context" in autofillContext, "autofill context endpoint must return a context key");
  assert(typeof autofillContext.matchMode === "string", "autofill context endpoint must return matchMode");

  const parseResult = await requestJson("/api/jobs/parse", {
    method: "POST",
    body: JSON.stringify({
      text: `公司: Smoke Test Tech
岗位: Backend Engineer Intern
地点: Singapore
链接: https://example.com/smoke
描述: Node.js, SQL, internship, graduate friendly, apply by 2026-09-30

Software Engineer Intern | Shopee | Singapore | https://careers.shopee.sg/job/software-engineer-intern
Graduate Data Analyst - HSBC - Hong Kong - https://www.hsbc.com/careers/jobs/graduate-data-analyst

LinkedIn Job Alert
Backend Engineer Graduate
ByteDance
Shanghai
View job: https://jobs.bytedance.com/en/position/backend-engineer-graduate`
    })
  });
  assert(Array.isArray(parseResult.parsed), "job parse endpoint must return parsed jobs");
  assert(typeof parseResult.total === "number", "job parse endpoint must return total count");
  assert(parseResult.parsed.length >= 4, "job parse endpoint must parse structured blocks and email alert rows");
  assert(parseResult.parsed.some((job) => job.company === "Shopee" && job.title.includes("Software Engineer")), "job parse endpoint must parse pipe-separated alert rows");
  assert(parseResult.parsed.some((job) => job.company === "HSBC" && job.market === "HK"), "job parse endpoint must parse dash-separated Hong Kong alert rows");
  assert(parseResult.parsed.some((job) => job.company === "ByteDance" && job.title.includes("Backend Engineer")), "job parse endpoint must infer email alert context around links");

  let smokeCleanup = null;
  let csvImport = null;
  let syncResult = null;
  try {
    csvImport = await requestJson("/api/jobs/import", {
      method: "POST",
      body: JSON.stringify({
        sourceName: smokeCsvSourceName,
        csv: `市场,公司,岗位,地点,链接,描述,匹配分
SG,Smoke CSV Tech,Backend Platform Intern,Singapore,https://example.com/__careerpilot-smoke-csv-job,Node SQL internship graduate friendly,83`
      })
    });

    assert(csvImport.batch?.importType === "csv", "CSV import must create a csv import batch");
    assert(csvImport.batch?.sourceName === smokeCsvSourceName, "CSV import batch must keep the source name");
    assert(Array.isArray(csvImport.jobs) && csvImport.jobs.length >= 1, "CSV import must return imported or updated jobs");
    assert(Number(csvImport.imported || 0) + Number(csvImport.deduped || 0) >= 1, "CSV import must import or dedupe at least one job");

    const syncSource = await requestJson("/api/job-sources", {
      method: "POST",
      body: JSON.stringify({
        name: smokeSyncSourceName,
        market: "GLOBAL",
        sourceType: "COMPANY_SITE",
        baseUrl: `${baseUrl}/ats-lab?type=workday`,
        reliability: 70
      })
    });
    assert(syncSource.source?.id, "source sync smoke must create a source");

    syncResult = await requestJson("/api/job-sources/sync", {
      method: "POST",
      body: JSON.stringify({ sourceId: syncSource.source.id })
    });
    assert(Array.isArray(syncResult.results), "source sync must return results");
    assert(syncResult.results[0]?.sourceId === syncSource.source.id, "source sync result must match requested source");
    assert(syncResult.results[0]?.status !== "failed", "source sync should fetch local public page in smoke");
    assert(typeof syncResult.results[0]?.extractedChars === "number", "source sync must report extracted text length");
  } finally {
    smokeCleanup = await cleanupSmokeData();
  }

  const finalJobs = await requestJson("/api/jobs");
  const finalSources = await requestJson("/api/job-sources");
  const finalBatches = await requestJson("/api/import-batches");

  if (jobs.jobs[0]?.id) {
    const jobPackage = await requestJson(`/api/jobs/${jobs.jobs[0].id}/package`);
    const packagePayload = jobPackage.package ?? jobPackage;
    assert(packagePayload.job?.id === jobs.jobs[0].id, "job package must return the requested job");
    assert(Array.isArray(packagePayload.drafts), "job package must return drafts");
    assert(Array.isArray(packagePayload.answers), "job package must return answers");
    if (packagePayload.application) {
      assert("nextAction" in packagePayload.application, "job package application must expose nextAction");
      assert("nextActionAt" in packagePayload.application, "job package application must expose nextActionAt");
    }
  }

  const backupResponse = await fetch(`${baseUrl}/api/backup/export`);
  const backup = await backupResponse.json().catch(() => ({}));
  assert(backupResponse.ok, `backup export failed: ${backupResponse.status}`);
  assert(backupResponse.headers.get("content-disposition")?.includes(localDateKey()), "backup export filename must use local date");
  assert(backup.product === "CareerPilot APAC", "backup export must include product name");
  assert(backup.schemaVersion >= 1, "backup export must include schema version");

  const preview = await requestJson("/api/backup/preview", {
    method: "POST",
    body: JSON.stringify(backup)
  });
  const previewPayload = preview.preview ?? preview;
  assert(previewPayload.ok === true, "backup preview of current export must pass");
  assert(previewPayload.mode === "merge", "backup preview must remain merge-only");

  let backupImportPayload = null;
  let backupImportCleanup = null;
  try {
    const backupImport = await requestJson("/api/backup/import", {
      method: "POST",
      body: JSON.stringify(buildBackupImportSmokePayload())
    });
    backupImportPayload = backupImport.result ?? backupImport;
    assert(backupImportPayload.ok === true, "backup import smoke must pass");
    assert(backupImportPayload.mode === "merge", "backup import must remain merge-only");
    assert(backupImportPayload.imported?.jobs >= 1, "backup import must merge at least one job");
    assert(backupImportPayload.imported?.applications >= 1, "backup import must merge at least one application");
    assert(backupImportPayload.imported?.formSnapshots >= 1, "backup import must merge at least one form snapshot");
    assert(backupImportPayload.imported?.formFields >= 2, "backup import must merge form snapshot fields");
  } finally {
    backupImportCleanup = await cleanupSmokeData();
  }

  const result = {
    ok: true,
    baseUrl,
    counts: {
      profileFields: profile.profile.fields.length,
      jobs: finalJobs.jobs.length,
      applications: applications.applications.length,
      answers: answers.items.length,
      sources: finalSources.sources.length,
      batches: finalBatches.batches.length,
      resumes: resumes.resumes.length,
      materialDrafts: materials.drafts.length,
      formSnapshots: snapshots.snapshots.length,
      autofillRuns: runs.runs.length
    },
    csvImportBatchType: csvImport.batch.importType,
    csvImportSourceName: csvImport.batch.sourceName,
    csvImportAffected: Number(csvImport.imported || 0) + Number(csvImport.deduped || 0),
    sourceSyncStatus: syncResult.results[0]?.status,
    sourceSyncTotal: syncResult.totals.total,
    smokeCleanup,
    parsedPreviewCount: parseResult.parsed.length,
    parseIssueCount: parseResult.errors,
    autofillContextMode: autofillContext.matchMode,
    backupSchemaVersion: backup.schemaVersion,
    backupImportJobs: backupImportPayload?.imported?.jobs ?? 0,
    backupImportApplications: backupImportPayload?.imported?.applications ?? 0,
    backupImportFormSnapshots: backupImportPayload?.imported?.formSnapshots ?? 0,
    backupImportFormFields: backupImportPayload?.imported?.formFields ?? 0,
    backupImportCleanup
  };

  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
