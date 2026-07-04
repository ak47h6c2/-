import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const appBase = process.env.CAREERPILOT_WEB_URL || "http://localhost:3000";
const runEdge = process.argv.includes("--edge");
const skipRuntime = process.argv.includes("--skip-runtime");
const outputDir = path.join(root, "output", "verification");
const reportPath = path.join(outputDir, "verify-report.json");
const acceptancePath = path.join(outputDir, "ACCEPTANCE.md");
const npmCliPath =
  process.env.npm_execpath && !process.env.npm_execpath.endsWith(".ps1")
    ? process.env.npm_execpath
    : path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");

const commandList = [
  { name: "docs", command: "npm", args: ["run", "docs:check"], captureJson: true },
  { name: "design system", command: "npm", args: ["run", "design:check", "-w", "@careerpilot/web"], captureJson: true },
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "lint", command: "npm", args: ["run", "lint"] },
  { name: "build", command: "npm", args: ["run", "build"] }
];

function now() {
  return new Date().toISOString();
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) return "n/a";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${Math.round(durationMs / 1000)}s`;
}

function passFail(value) {
  return value ? "PASS" : "FAIL";
}

function tailText(value, maxLength = 4000) {
  if (!value) return "";
  return value.length > maxLength ? value.slice(-maxLength) : value;
}

function parseLastJsonObject(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    if (!line.startsWith("{") || !line.endsWith("}")) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Keep scanning; npm output can contain non-JSON status lines.
    }
  }

  return null;
}

function getStep(report, name) {
  return report.steps.find((step) => step.name === name);
}

function countVisualIssues(captures, key) {
  return captures.reduce((sum, capture) => sum + (Array.isArray(capture[key]) ? capture[key].length : 0), 0);
}

function writeTable(rows) {
  return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function generateAcceptanceMarkdown(report) {
  const docs = getStep(report, "docs")?.summary;
  const design = getStep(report, "design system")?.summary;
  const api = getStep(report, "api smoke")?.summary;
  const visual = getStep(report, "visual smoke")?.summary;
  const edge = getStep(report, "edge extension smoke")?.summary;
  const cleanup = getStep(report, "smoke data cleanup")?.summary;
  const captures = visual?.captures || [];
  const dashboardCaptures = captures.filter((capture) => capture.type === "dashboard");
  const atsCaptures = captures.filter((capture) => capture.type === "ats");
  const atsPageNames = [...new Set(atsCaptures.map((capture) => capture.page).filter(Boolean))];
  const atsVendorNames = [...new Set(atsCaptures.map((capture) => capture.vendor).filter(Boolean))];
  const standaloneCaptures = captures.filter((capture) => capture.type === "standalone");
  const clippedCount = countVisualIssues(captures, "clipped");
  const unlabeledCount = countVisualIssues(captures, "unlabeledControls");
  const skipLinkFailures = dashboardCaptures.filter((capture) => capture.skipLinkVisible !== true).length;
  const packageCaptures = dashboardCaptures.filter((capture) => capture.section === "package");
  const sourceCaptures = dashboardCaptures.filter((capture) => capture.section === "sources");
  const materialCaptures = dashboardCaptures.filter((capture) => capture.section === "materials");
  const autofillCaptures = dashboardCaptures.filter((capture) => capture.section === "autofill");
  const marketCaptures = dashboardCaptures.filter((capture) => capture.section === "markets");
  const applicationCaptures = dashboardCaptures.filter((capture) => capture.section === "applications");
  const interviewCaptures = dashboardCaptures.filter((capture) => capture.section === "interviews");
  const todayCaptures = dashboardCaptures.filter((capture) => capture.section === "today");
  const backupCaptures = dashboardCaptures.filter((capture) => capture.section === "backup");
  const localDate = localDateKey();
  const downloadedFilenames = [
    ...todayCaptures.map((capture) => capture.todayDownloadedPlanFilename),
    ...packageCaptures.map((capture) => capture.packageDownloadedSummaryFilename),
    ...applicationCaptures.map((capture) => capture.applicationDownloadedFollowUpFilename),
    ...applicationCaptures.map((capture) => capture.applicationDownloadedPipelineCsvFilename),
    ...marketCaptures.map((capture) => capture.marketDownloadedJobsCsvFilename),
    ...autofillCaptures.map((capture) => capture.profileDownloadedPackFilename)
  ].filter(Boolean);
  const localDateDownloadCount = downloadedFilenames.filter((filename) => String(filename).startsWith(localDate)).length;
  const minPackageMaterialEditors = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageMaterialEditors || 0))) : 0;
  const minPackageSaveDraftButtons = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageSaveDraftButtons || 0))) : 0;
  const packageSubmitChecklistCount = packageCaptures.filter((capture) => capture.packageSubmitChecklist === true).length;
  const minPackageSubmitChecklistItems = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageSubmitChecklistItems || 0))) : 0;
  const minPackageCopyChecklistButtons = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageCopyChecklistButtons || 0))) : 0;
  const minPackageCopySummaryButtons = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageCopySummaryButtons || 0))) : 0;
  const minPackageDownloadSummaryButtons = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageDownloadSummaryButtons || 0))) : 0;
  const packageDownloadedSummaryCount = packageCaptures.filter((capture) => capture.packageDownloadedSummaryHasBoundary === true).length;
  const minPackageDownloadedSummaryBytes = packageCaptures.length ? Math.min(...packageCaptures.map((capture) => Number(capture.packageDownloadedSummaryBytes || 0))) : 0;
  const packageDeepLinkReadyCount = packageCaptures.filter((capture) => capture.packageDeepLinkReady === true).length;
  const globalSearchPanelCount = dashboardCaptures.filter((capture) => capture.globalSearchPanel === true).length;
  const minGlobalSearchInputs = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.globalSearchInputs || 0))) : 0;
  const minGlobalSearchResultButtons = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.globalSearchResultButtons || 0))) : 0;
  const globalSearchHitCount = todayCaptures.filter((capture) => String(capture.globalSearchCountText || "").includes("命中") && capture.globalSearchQueryValue === "字节").length;
  const globalSearchShortcutFocusCount = todayCaptures.filter((capture) => capture.globalSearchKeyboardShortcutFocused === true).length;
  const globalSearchArrowSelectionCount = todayCaptures.filter((capture) => capture.globalSearchKeyboardArrowMoved === true && capture.globalSearchArrowSelectionMoved === true).length;
  const globalSearchEnterOpenCount = todayCaptures.filter((capture) => capture.globalSearchEnterOpenedPackage === true).length;
  const setupChecklistPanelCount = dashboardCaptures.filter((capture) => capture.setupChecklistPanel === true).length;
  const minSetupChecklistCards = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.setupChecklistCards || 0))) : 0;
  const minSetupChecklistCopyButtons = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.setupChecklistCopyButtons || 0))) : 0;
  const minSetupChecklistNextButtons = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.setupChecklistNextButtons || 0))) : 0;
  const localRunStatusPanelCount = dashboardCaptures.filter((capture) => capture.localRunStatusPanel === true).length;
  const minLocalRunStatusCards = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.localRunStatusCards || 0))) : 0;
  const minLocalRunStatusCopyButtons = dashboardCaptures.length ? Math.min(...dashboardCaptures.map((capture) => Number(capture.localRunStatusCopyButtons || 0))) : 0;
  const minSourceEditorCards = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceEditorCards || 0))) : 0;
  const minSourceSaveButtons = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceSaveButtons || 0))) : 0;
  const minSourceCsvFileInputs = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceCsvFileInputs || 0))) : 0;
  const minSourceCsvImportButtons = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceCsvImportButtons || 0))) : 0;
  const sourceCsvLoadedCount = sourceCaptures.filter((capture) => String(capture.sourceCsvPreviewText || "").includes("Visual CSV Tech")).length;
  const sourceCsvResultMessageCount = sourceCaptures.filter((capture) => String(capture.sourceCsvImportMessage || "").includes("导入完成")).length;
  const sourceSyncPanelCount = sourceCaptures.filter((capture) => capture.sourceSyncPanel === true).length;
  const minSourceSyncMetrics = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceSyncMetrics || 0))) : 0;
  const minSourceSyncButtons = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceSyncButtons || 0))) : 0;
  const minSourceCardSyncButtons = sourceCaptures.length ? Math.min(...sourceCaptures.map((capture) => Number(capture.sourceCardSyncButtons || 0))) : 0;
  const minResumeEditorCards = materialCaptures.length ? Math.min(...materialCaptures.map((capture) => Number(capture.resumeEditorCards || 0))) : 0;
  const minResumeEditorTextareas = materialCaptures.length ? Math.min(...materialCaptures.map((capture) => Number(capture.resumeEditorTextareas || 0))) : 0;
  const minResumeSaveButtons = materialCaptures.length ? Math.min(...materialCaptures.map((capture) => Number(capture.resumeSaveButtons || 0))) : 0;
  const profileReadinessPanelCount = autofillCaptures.filter((capture) => capture.profileReadinessPanel === true).length;
  const minProfileCompletionCards = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profileCompletionCards || 0))) : 0;
  const minProfileAddTemplateButtons = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profileAddTemplateButtons || 0))) : 0;
  const minProfileCopyGapButtons = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profileCopyGapButtons || 0))) : 0;
  const profilePackPanelCount = autofillCaptures.filter((capture) => capture.profilePackPanel === true).length;
  const minProfilePackMetricTiles = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profilePackMetricTiles || 0))) : 0;
  const minProfilePackCopyButtons = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profilePackCopyButtons || 0))) : 0;
  const minProfilePackDownloadButtons = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profilePackDownloadButtons || 0))) : 0;
  const profileDownloadedPackCount = autofillCaptures.filter((capture) => capture.profileDownloadedPackHasBoundary === true).length;
  const minProfileDownloadedPackBytes = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.profileDownloadedPackBytes || 0))) : 0;
  const mappingLearningPanelCount = autofillCaptures.filter((capture) => capture.mappingLearningPanel === true).length;
  const minMappingLearningMetricTiles = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.mappingLearningMetricTiles || 0))) : 0;
  const minMappingLearningBatchButtons = autofillCaptures.length ? Math.min(...autofillCaptures.map((capture) => Number(capture.mappingLearningBatchButtons || 0))) : 0;
  const minJobEditorCards = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobEditorCards || 0))) : 0;
  const minJobSaveButtons = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobSaveButtons || 0))) : 0;
  const minJobArchiveControls = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobArchiveControls || 0))) : 0;
  const jobQualityPanelCount = marketCaptures.filter((capture) => capture.jobQualityPanel === true).length;
  const minJobQualityCards = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobQualityCards || 0))) : 0;
  const minJobQualityCopyButtons = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobQualityCopyButtons || 0))) : 0;
  const minJobCsvExportButtons = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobCsvExportButtons || 0))) : 0;
  const minJobQualityFilterSelects = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.jobQualityFilterSelects || 0))) : 0;
  const marketDownloadedJobsCsvCount = marketCaptures.filter((capture) => String(capture.marketDownloadedJobsCsvFilename || "").endsWith(".csv")).length;
  const minMarketDownloadedJobsCsvBytes = marketCaptures.length ? Math.min(...marketCaptures.map((capture) => Number(capture.marketDownloadedJobsCsvBytes || 0))) : 0;
  const minAnswerEditorCards = interviewCaptures.length ? Math.min(...interviewCaptures.map((capture) => Number(capture.answerEditorCards || 0))) : 0;
  const minAnswerSensitivitySelects = interviewCaptures.length ? Math.min(...interviewCaptures.map((capture) => Number(capture.answerSensitivitySelects || 0))) : 0;
  const minAnswerSaveButtons = interviewCaptures.length ? Math.min(...interviewCaptures.map((capture) => Number(capture.answerSaveButtons || 0))) : 0;
  const minApplicationNextActionInputs = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationNextActionInputs || 0))) : 0;
  const minApplicationFollowUpDateInputs = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationFollowUpDateInputs || 0))) : 0;
  const applicationFollowUpCalendarPanelCount = applicationCaptures.filter((capture) => capture.applicationFollowUpCalendarPanel === true).length;
  const minApplicationFollowUpCalendarMetrics = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationFollowUpCalendarMetrics || 0))) : 0;
  const minApplicationFollowUpDayCards = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationFollowUpDayCards || 0))) : 0;
  const minApplicationFollowUpCopyButtons = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationFollowUpCopyButtons || 0))) : 0;
  const minApplicationFollowUpDownloadButtons = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationFollowUpDownloadButtons || 0))) : 0;
  const minApplicationPipelineCsvButtons = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationPipelineCsvButtons || 0))) : 0;
  const minApplicationScheduleMissingButtons = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationScheduleMissingButtons || 0))) : 0;
  const applicationReviewPanelCount = applicationCaptures.filter((capture) => capture.applicationReviewPanel === true).length;
  const minApplicationReviewMetrics = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationReviewMetrics || 0))) : 0;
  const minApplicationReviewCopyButtons = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationReviewCopyButtons || 0))) : 0;
  const minApplicationMarketFunnelRows = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationMarketFunnelRows || 0))) : 0;
  const applicationDownloadedFollowUpCount = applicationCaptures.filter((capture) => capture.applicationDownloadedFollowUpHasBoundary === true).length;
  const minApplicationDownloadedFollowUpBytes = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationDownloadedFollowUpBytes || 0))) : 0;
  const applicationDownloadedPipelineCsvCount = applicationCaptures.filter((capture) => String(capture.applicationDownloadedPipelineCsvFilename || "").endsWith(".csv")).length;
  const minApplicationDownloadedPipelineCsvBytes = applicationCaptures.length ? Math.min(...applicationCaptures.map((capture) => Number(capture.applicationDownloadedPipelineCsvBytes || 0))) : 0;
  const todayFollowUpPanelCount = todayCaptures.filter((capture) => capture.todayFollowUpPanel === true).length;
  const todayRefreshPanelCount = todayCaptures.filter((capture) => capture.todayRefreshPanel === true).length;
  const minTodayRefreshMetrics = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayRefreshMetrics || 0))) : 0;
  const minTodayRefreshButtons = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayRefreshButtons || 0))) : 0;
  const minTodayOpenSourcesButtons = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayOpenSourcesButtons || 0))) : 0;
  const todayProgressPanelCount = todayCaptures.filter((capture) => capture.todayProgressPanel === true).length;
  const minTodayProgressMetrics = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayProgressMetrics || 0))) : 0;
  const minTodayTaskCards = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayTaskCards || 0))) : 0;
  const todayActionPanelCount = todayCaptures.filter((capture) => capture.todayActionPanel === true).length;
  const minTodayActionCards = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayActionCards || 0))) : 0;
  const minTodayCopyActionQueueButtons = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayCopyActionQueueButtons || 0))) : 0;
  const minTodayOpenFirstActionButtons = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayOpenFirstActionButtons || 0))) : 0;
  const minTodayCopyPlanButtons = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayCopyPlanButtons || 0))) : 0;
  const minTodayDownloadPlanButtons = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayDownloadPlanButtons || 0))) : 0;
  const todayDownloadedPlanCount = todayCaptures.filter((capture) => capture.todayDownloadedPlanHasBoundary === true).length;
  const minTodayDownloadedPlanBytes = todayCaptures.length ? Math.min(...todayCaptures.map((capture) => Number(capture.todayDownloadedPlanBytes || 0))) : 0;
  const backupHealthPanelCount = backupCaptures.filter((capture) => capture.backupHealthPanel === true).length;
  const minBackupHealthCards = backupCaptures.length ? Math.min(...backupCaptures.map((capture) => Number(capture.backupHealthCards || 0))) : 0;
  const minBackupCopyMaintenanceButtons = backupCaptures.length ? Math.min(...backupCaptures.map((capture) => Number(capture.backupCopyMaintenanceButtons || 0))) : 0;
  const maxOverflow = captures.reduce((max, capture) => Math.max(max, Number(capture.horizontalOverflow || 0)), 0);

  const lines = [
    "# CareerPilot APAC Acceptance Summary",
    "",
    `Status: ${passFail(report.ok)}`,
    `Generated: ${new Date().toISOString()}`,
    `App base: ${report.appBase}`,
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt || "n/a"}`,
    `Duration: ${formatDuration(report.durationMs)}`,
    `Runtime checks: ${report.skipRuntime ? "skipped" : "enabled"}`,
    `Edge smoke: ${report.runEdge ? "requested" : "not requested"}`,
    "",
    "## Gate Results",
    "",
    writeTable([
      ["Gate", "Status", "Duration"],
      ["---", "---", "---"],
      ...report.steps.map((step) => [step.name, passFail(step.ok), formatDuration(step.durationMs)])
    ]),
    "",
    "## Documentation",
    "",
    docs
      ? writeTable([
          ["Metric", "Value"],
          ["---", "---"],
          ["Docs health", passFail(docs.ok)],
          ["Checked files", String(docs.checkedFiles)],
          ["Checked terms", String(docs.checkedTerms)]
        ])
      : "Documentation summary was not captured.",
    "",
    "## Design System",
    "",
    design
      ? writeTable([
          ["Metric", "Value"],
          ["---", "---"],
          ["Tokens", String(design.tokenCount)],
          ["Components", String(design.componentCount)],
          ["Quality gates", String(design.qualityGateCount)],
          ["Figma script hash", design.figmaScriptHash]
        ])
      : "Design system summary was not captured.",
    "",
    "## Runtime API Smoke",
    "",
    api
      ? writeTable([
          ["Metric", "Value"],
          ["---", "---"],
          ["Profile fields", String(api.counts?.profileFields ?? "n/a")],
          ["Jobs", String(api.counts?.jobs ?? "n/a")],
          ["Applications", String(api.counts?.applications ?? "n/a")],
          ["Answers", String(api.counts?.answers ?? "n/a")],
          ["Sources", String(api.counts?.sources ?? "n/a")],
          ["Resumes", String(api.counts?.resumes ?? "n/a")],
          ["Material drafts", String(api.counts?.materialDrafts ?? "n/a")],
          ["Form snapshots", String(api.counts?.formSnapshots ?? "n/a")],
          ["Autofill runs", String(api.counts?.autofillRuns ?? "n/a")],
          ["CSV import batch type", String(api.csvImportBatchType ?? "n/a")],
          ["CSV import source", String(api.csvImportSourceName ?? "n/a")],
          ["CSV import affected jobs", String(api.csvImportAffected ?? "n/a")],
          ["Source sync status", String(api.sourceSyncStatus ?? "n/a")],
          ["Source sync parsed total", String(api.sourceSyncTotal ?? "n/a")],
          ["API smoke cleanup jobs", String(api.smokeCleanup?.deleted?.jobs ?? "n/a")],
          ["Parsed preview count", String(api.parsedPreviewCount ?? "n/a")],
          ["Parse issue count", String(api.parseIssueCount ?? "n/a")],
          ["Autofill context mode", String(api.autofillContextMode ?? "n/a")],
          ["Backup schema version", String(api.backupSchemaVersion ?? "n/a")],
          ["Backup import jobs", String(api.backupImportJobs ?? "n/a")],
          ["Backup import applications", String(api.backupImportApplications ?? "n/a")],
          ["Backup import form snapshots", String(api.backupImportFormSnapshots ?? "n/a")],
          ["Backup import form fields", String(api.backupImportFormFields ?? "n/a")]
        ])
      : report.skipRuntime
        ? "Runtime API smoke was skipped."
        : "Runtime API smoke summary was not captured.",
    "",
    "## Visual Smoke",
    "",
    visual
      ? writeTable([
          ["Metric", "Value"],
          ["---", "---"],
          ["Capture count", String(visual.captureCount)],
          ["Dashboard captures", String(dashboardCaptures.length)],
          ["ATS captures", String(atsCaptures.length)],
          ["ATS page variants", `${atsPageNames.length}: ${atsPageNames.join(", ")}`],
          ["ATS vendors", atsVendorNames.join(", ") || "n/a"],
          ["Design-system captures", String(standaloneCaptures.length)],
          ["Max horizontal overflow", String(maxOverflow)],
          ["Clipped controls", String(clippedCount)],
          ["Unlabeled controls", String(unlabeledCount)],
          ["Skip link failures", String(skipLinkFailures)],
          ["Package material editors", String(minPackageMaterialEditors)],
          ["Package save draft buttons", String(minPackageSaveDraftButtons)],
          ["Package submit checklists", `${packageSubmitChecklistCount}/${packageCaptures.length}`],
          ["Package submit checklist items", String(minPackageSubmitChecklistItems)],
          ["Package copy checklist buttons", String(minPackageCopyChecklistButtons)],
          ["Package copy summary buttons", String(minPackageCopySummaryButtons)],
          ["Package download summary buttons", String(minPackageDownloadSummaryButtons)],
          ["Package downloaded summaries", `${packageDownloadedSummaryCount}/${packageCaptures.length}`],
          ["Package downloaded summary bytes", String(minPackageDownloadedSummaryBytes)],
          ["Package deep-link targets", `${packageDeepLinkReadyCount}/${packageCaptures.length}`],
          ["Global search panels", `${globalSearchPanelCount}/${dashboardCaptures.length}`],
          ["Global search inputs", String(minGlobalSearchInputs)],
          ["Global search result buttons", String(minGlobalSearchResultButtons)],
          ["Global search typed hits", `${globalSearchHitCount}/${todayCaptures.length}`],
          ["Global search shortcut focus", `${globalSearchShortcutFocusCount}/${todayCaptures.length}`],
          ["Global search arrow selection", `${globalSearchArrowSelectionCount}/${todayCaptures.length}`],
          ["Global search Enter opens result", `${globalSearchEnterOpenCount}/${todayCaptures.length}`],
          ["Local-date download filenames", `${localDateDownloadCount}/${downloadedFilenames.length}`],
          ["Setup checklist panels", `${setupChecklistPanelCount}/${dashboardCaptures.length}`],
          ["Setup checklist cards", String(minSetupChecklistCards)],
          ["Setup checklist copy buttons", String(minSetupChecklistCopyButtons)],
          ["Setup checklist next buttons", String(minSetupChecklistNextButtons)],
          ["Local run status bars", `${localRunStatusPanelCount}/${dashboardCaptures.length}`],
          ["Local run status cards", String(minLocalRunStatusCards)],
          ["Local run status copy buttons", String(minLocalRunStatusCopyButtons)],
          ["Source editor cards", String(minSourceEditorCards)],
          ["Source save buttons", String(minSourceSaveButtons)],
          ["Source CSV file inputs", String(minSourceCsvFileInputs)],
          ["Source CSV import buttons", String(minSourceCsvImportButtons)],
          ["Source CSV loaded files", `${sourceCsvLoadedCount}/${sourceCaptures.length}`],
          ["Source CSV result messages", `${sourceCsvResultMessageCount}/${sourceCaptures.length}`],
          ["Source sync panels", `${sourceSyncPanelCount}/${sourceCaptures.length}`],
          ["Source sync metrics", String(minSourceSyncMetrics)],
          ["Source sync buttons", String(minSourceSyncButtons)],
          ["Source card sync buttons", String(minSourceCardSyncButtons)],
          ["Resume editor cards", String(minResumeEditorCards)],
          ["Resume editor textareas", String(minResumeEditorTextareas)],
          ["Resume save buttons", String(minResumeSaveButtons)],
          ["Profile readiness panels", `${profileReadinessPanelCount}/${autofillCaptures.length}`],
          ["Profile completion cards", String(minProfileCompletionCards)],
          ["Profile add template buttons", String(minProfileAddTemplateButtons)],
          ["Profile copy gap buttons", String(minProfileCopyGapButtons)],
          ["Profile quick-reference panels", `${profilePackPanelCount}/${autofillCaptures.length}`],
          ["Profile quick-reference metrics", String(minProfilePackMetricTiles)],
          ["Profile quick-reference copy buttons", String(minProfilePackCopyButtons)],
          ["Profile quick-reference download buttons", String(minProfilePackDownloadButtons)],
          ["Profile downloaded packs", `${profileDownloadedPackCount}/${autofillCaptures.length}`],
          ["Profile downloaded pack bytes", String(minProfileDownloadedPackBytes)],
          ["Mapping learning panels", `${mappingLearningPanelCount}/${autofillCaptures.length}`],
          ["Mapping learning metrics", String(minMappingLearningMetricTiles)],
          ["Mapping batch-save buttons", String(minMappingLearningBatchButtons)],
          ["Job editor cards", String(minJobEditorCards)],
          ["Job save buttons", String(minJobSaveButtons)],
          ["Job archive controls", String(minJobArchiveControls)],
          ["Job quality panels", `${jobQualityPanelCount}/${marketCaptures.length}`],
          ["Job quality cards", String(minJobQualityCards)],
          ["Job quality copy buttons", String(minJobQualityCopyButtons)],
          ["Job CSV export buttons", String(minJobCsvExportButtons)],
          ["Job downloaded CSVs", `${marketDownloadedJobsCsvCount}/${marketCaptures.length}`],
          ["Job downloaded CSV bytes", String(minMarketDownloadedJobsCsvBytes)],
          ["Job quality filter selects", String(minJobQualityFilterSelects)],
          ["Answer editor cards", String(minAnswerEditorCards)],
          ["Answer sensitivity selects", String(minAnswerSensitivitySelects)],
          ["Answer save buttons", String(minAnswerSaveButtons)],
          ["Application next-action inputs", String(minApplicationNextActionInputs)],
          ["Application follow-up date inputs", String(minApplicationFollowUpDateInputs)],
          ["Application 7-day follow-up panels", `${applicationFollowUpCalendarPanelCount}/${applicationCaptures.length}`],
          ["Application 7-day follow-up metrics", String(minApplicationFollowUpCalendarMetrics)],
          ["Application 7-day day cards", String(minApplicationFollowUpDayCards)],
          ["Application 7-day copy buttons", String(minApplicationFollowUpCopyButtons)],
          ["Application 7-day download buttons", String(minApplicationFollowUpDownloadButtons)],
          ["Application pipeline CSV buttons", String(minApplicationPipelineCsvButtons)],
          ["Application downloaded pipeline CSVs", `${applicationDownloadedPipelineCsvCount}/${applicationCaptures.length}`],
          ["Application downloaded pipeline CSV bytes", String(minApplicationDownloadedPipelineCsvBytes)],
          ["Application missing follow-up schedule buttons", String(minApplicationScheduleMissingButtons)],
          ["Application review panels", `${applicationReviewPanelCount}/${applicationCaptures.length}`],
          ["Application review metrics", String(minApplicationReviewMetrics)],
          ["Application review copy buttons", String(minApplicationReviewCopyButtons)],
          ["Application market funnel rows", String(minApplicationMarketFunnelRows)],
          ["Application downloaded follow-up plans", `${applicationDownloadedFollowUpCount}/${applicationCaptures.length}`],
          ["Application downloaded follow-up bytes", String(minApplicationDownloadedFollowUpBytes)],
          ["Today follow-up panels", `${todayFollowUpPanelCount}/${todayCaptures.length}`],
          ["Today source refresh panels", `${todayRefreshPanelCount}/${todayCaptures.length}`],
          ["Today source refresh metrics", String(minTodayRefreshMetrics)],
          ["Today source refresh buttons", String(minTodayRefreshButtons)],
          ["Today source management buttons", String(minTodayOpenSourcesButtons)],
          ["Today progress panels", `${todayProgressPanelCount}/${todayCaptures.length}`],
          ["Today progress metrics", String(minTodayProgressMetrics)],
          ["Today task cards", String(minTodayTaskCards)],
          ["Today action panels", `${todayActionPanelCount}/${todayCaptures.length}`],
          ["Today action cards", String(minTodayActionCards)],
          ["Today copy action queue buttons", String(minTodayCopyActionQueueButtons)],
          ["Today open first action buttons", String(minTodayOpenFirstActionButtons)],
          ["Today copy plan buttons", String(minTodayCopyPlanButtons)],
          ["Today download plan buttons", String(minTodayDownloadPlanButtons)],
          ["Today downloaded plans", `${todayDownloadedPlanCount}/${todayCaptures.length}`],
          ["Today downloaded plan bytes", String(minTodayDownloadedPlanBytes)],
          ["Backup health panels", `${backupHealthPanelCount}/${backupCaptures.length}`],
          ["Backup health cards", String(minBackupHealthCards)],
          ["Backup copy maintenance buttons", String(minBackupCopyMaintenanceButtons)],
          ["Console errors", String((visual.consoleErrors || []).length)],
          ["Output directory", "output/playwright/web-visual-smoke"]
        ])
      : report.skipRuntime
        ? "Visual smoke was skipped."
        : "Visual smoke summary was not captured.",
    "",
    "## Edge Extension",
    "",
    edge
      ? "Edge extension smoke summary was captured in the JSON report."
      : report.runEdge
        ? "Edge extension smoke was requested, but no structured summary was captured."
        : "Edge extension smoke was not requested for this run. Use `npm run verify:edge` for extension runtime coverage.",
    "",
    "## Smoke Data Cleanup",
    "",
    cleanup
      ? writeTable([
          ["Metric", "Value"],
          ["---", "---"],
          ["Cleanup status", passFail(cleanup.ok)],
          ["Deleted smoke jobs", String(cleanup.deleted?.jobs ?? 0)],
          ["Deleted smoke batches", String(cleanup.deleted?.batches ?? 0)],
          ["Deleted smoke sync logs", String(cleanup.deleted?.syncLogs ?? 0)],
          ["Deleted smoke sources", String(cleanup.deleted?.sources ?? 0)]
        ])
      : report.skipRuntime
        ? "Smoke data cleanup was skipped with runtime checks."
        : "Smoke data cleanup summary was not captured.",
    "",
    "## Runtime Health",
    "",
    report.runtime?.health
      ? writeTable([
          ["Metric", "Value"],
          ["---", "---"],
          ["Text encoding health", passFail(report.runtime.health.ok)],
          ["File encoding issues", String(report.runtime.health.files?.length ?? 0)],
          ["Database encoding issues", String(report.runtime.health.database?.length ?? 0)],
          ["Verify started web server", String(report.runtime.webServerStartedByVerify)]
        ])
      : "Runtime health was not checked.",
    ""
  ];

  if (!report.ok || report.error) {
    lines.push("## Failure", "", report.error || "Unknown failure.", "");
    for (const step of report.steps.filter((item) => item.stdoutTail || item.stderrTail)) {
      lines.push(`### ${step.name}`, "");
      if (step.stdoutTail) {
        lines.push("Stdout tail:", "", "```text", step.stdoutTail, "```", "");
      }
      if (step.stderrTail) {
        lines.push("Stderr tail:", "", "```text", step.stderrTail, "```", "");
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function runCommand(step) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const command = step.command === "npm" ? process.execPath : step.command;
    const args = step.command === "npm" ? [npmCliPath, ...step.args] : step.args;
    console.log(`\n[verify] ${step.name}`);
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, {
      cwd: step.cwd || root,
      env: { ...process.env, ...(step.env || {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      const durationMs = Date.now() - startedAt;
      const result = { name: step.name, ok: code === 0, durationMs };

      if (step.captureJson) {
        result.summary = parseLastJsonObject(stdout);
      }

      if (code === 0) {
        resolve(result);
      } else {
        result.stdoutTail = tailText(stdout);
        result.stderrTail = tailText(stderr);
        reject(Object.assign(new Error(`${step.name} failed with exit code ${code}`), { step: step.name, durationMs, stepResult: result }));
      }
    });
  });
}

async function fetchHealth() {
  const response = await fetch(`${appBase}/api/health/text-encoding`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(`Health check failed: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function waitForHealth(timeoutMs = 45000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await fetchHealth();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError || new Error("Timed out waiting for CareerPilot web app.");
}

async function ensureWebServer() {
  try {
    const health = await fetchHealth();
    return { started: false, health, process: null };
  } catch {
    console.log("[verify] Starting temporary web dev server for runtime checks.");
  }

  const server = spawn(process.execPath, [npmCliPath, "run", "dev", "-w", "@careerpilot/web"], {
    cwd: root,
    env: { ...process.env, PORT: new URL(appBase).port || "3000" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[web] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[web] ${chunk}`));

  const health = await waitForHealth();
  return { started: true, health, process: server };
}

function waitForProcessExit(child, timeoutMs = 2500) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
      resolve(value);
    };
    const onExit = () => finish(true);
    const onError = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    child.once("exit", onExit);
    child.once("error", onError);
  });
}

function killWindowsProcessTree(pid) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore"
    });
    const timer = setTimeout(finish, 5000);

    killer.once("exit", finish);
    killer.once("error", finish);
  });
}

async function stopWebServer(serverInfo) {
  if (!serverInfo?.started || !serverInfo.process) return;

  serverInfo.process.stdout?.removeAllListeners("data");
  serverInfo.process.stderr?.removeAllListeners("data");

  if (process.platform === "win32") {
    await killWindowsProcessTree(serverInfo.process.pid);
  } else {
    serverInfo.process.kill("SIGTERM");
    const exited = await waitForProcessExit(serverInfo.process);
    if (!exited) {
      serverInfo.process.kill("SIGKILL");
    }
  }

  await waitForProcessExit(serverInfo.process);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const startedAt = Date.now();
  const report = {
    ok: false,
    startedAt: now(),
    appBase,
    runEdge,
    skipRuntime,
    steps: [],
    runtime: null
  };

  let serverInfo = null;

  try {
    for (const step of commandList) {
      report.steps.push(await runCommand(step));
    }

    if (!skipRuntime) {
      serverInfo = await ensureWebServer();
      report.runtime = {
        health: serverInfo.health,
        webServerStartedByVerify: serverInfo.started
      };
      const runtimeEnv = { CAREERPILOT_WEB_URL: appBase };
      report.steps.push(await runCommand({ name: "api smoke", command: "npm", args: ["run", "api:smoke", "-w", "@careerpilot/web"], captureJson: true, env: runtimeEnv }));
      report.steps.push(await runCommand({ name: "visual smoke", command: "npm", args: ["run", "visual:smoke", "-w", "@careerpilot/web"], captureJson: true, env: runtimeEnv }));
      report.steps.push(await runCommand({ name: "smoke data cleanup", command: "npm", args: ["run", "smoke:cleanup", "-w", "@careerpilot/web"], captureJson: true }));
    }

    if (runEdge) {
      report.steps.push(await runCommand({ name: "edge extension smoke", command: "npm", args: ["run", "smoke", "-w", "@careerpilot/edge-extension"], captureJson: true }));
    }

    report.ok = true;
    report.finishedAt = now();
    report.durationMs = Date.now() - startedAt;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    await fs.writeFile(acceptancePath, generateAcceptanceMarkdown(report), "utf8");
    console.log(`\n[verify] ok (${Math.round(report.durationMs / 1000)}s)`);
    console.log(`[verify] report: ${reportPath}`);
    console.log(`[verify] acceptance: ${acceptancePath}`);
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    if (error?.stepResult && !report.steps.some((step) => step.name === error.stepResult.name)) {
      report.steps.push(error.stepResult);
    }
    report.finishedAt = now();
    report.durationMs = Date.now() - startedAt;
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8").catch(() => null);
    await fs.writeFile(acceptancePath, generateAcceptanceMarkdown(report), "utf8").catch(() => null);
    console.error(`\n[verify] failed: ${report.error}`);
    process.exitCode = 1;
  } finally {
    await stopWebServer(serverInfo);
  }
}

main();
