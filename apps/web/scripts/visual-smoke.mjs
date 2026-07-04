import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { cleanupSmokeData, smokeFormUrls } from "./smoke-artifacts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
const outputDir = path.join(workspaceRoot, "output", "playwright", "web-visual-smoke");
const baseUrl = process.env.CAREERPILOT_WEB_URL || "http://localhost:3000";

const sections = ["today", "package", "sources", "materials", "autofill", "applications", "markets", "interviews", "backup"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 }
];

const atsPages = [
  { name: "ats-workday", url: "/ats-lab?type=workday", expectedVendor: "Workday" },
  { name: "ats-greenhouse", url: "/ats-lab?type=greenhouse", expectedVendor: "Greenhouse" },
  { name: "ats-lever", url: "/ats-lab?type=lever", expectedVendor: "Lever" },
  { name: "ats-smartrecruiters", url: "/ats-lab?type=smartrecruiters", expectedVendor: "SmartRecruiters" },
  { name: "ats-ashby", url: "/ats-lab?type=ashby", expectedVendor: "Ashby" },
  { name: "ats-bamboohr", url: "/ats-lab?type=bamboohr", expectedVendor: "BambooHR" },
  { name: "ats-company", url: "/ats-lab?type=company", expectedVendor: "通用表单" }
];

const standalonePages = [{ name: "design-system", url: "/design-system", selector: ".design-system-page", minTextLength: 1200 }];

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  return payload;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  return payload;
}

async function requireHealthyApp() {
  const health = await fetchJson(`${baseUrl}/api/health/text-encoding`);
  if (!health.ok) {
    throw new Error("CareerPilot web health check failed.");
  }
}

async function ensureTodayPlanForSmoke() {
  const current = await fetchJson(`${baseUrl}/api/daily-sprint/plan`).catch(() => ({ plan: null }));
  if (current.plan?.tasks?.length) return;
  await postJson(`${baseUrl}/api/daily-sprint/plan`, { targetCount: 5 });
}

async function ensureAutofillSnapshotForSmoke() {
  const snapshots = await fetchJson(`${baseUrl}/api/autofill/snapshots`).catch(() => ({ snapshots: [] }));
  if (snapshots.snapshots?.some((snapshot) => smokeFormUrls.includes(snapshot.url))) return;

  await postJson(`${baseUrl}/api/autofill/snapshots`, {
    url: smokeFormUrls[0],
    title: "__careerpilot_smoke_form Workday",
    atsVendor: "Workday",
    source: "SMOKE",
    fields: [
      { label: "First Name", inputName: "firstName", inputType: "text", required: true },
      { label: "Last Name", inputName: "lastName", inputType: "text", required: true },
      { label: "Email", inputName: "email", inputType: "email", required: true },
      { label: "Mobile Phone", inputName: "phone", inputType: "tel", required: true },
      { label: "LinkedIn Profile", inputName: "linkedin", inputType: "url", required: false },
      { label: "University", inputName: "school", inputType: "text", required: true },
      { label: "Degree", inputName: "degree", inputType: "text", required: true },
      { label: "Major", inputName: "major", inputType: "text", required: false },
      { label: "Expected Salary", inputName: "salaryExpectation", inputType: "text", required: false },
      { label: "Right to Work", inputName: "workAuthorization", inputType: "select-one", required: true },
      { label: "Visa Sponsorship", inputName: "visaSponsorship", inputType: "select-one", required: true },
      { label: "Portfolio Website", inputName: "portfolio", inputType: "url", required: false },
      { label: "Source Channel", inputName: "sourceChannel", inputType: "text", required: false },
      { label: "Referral Name", inputName: "referralName", inputType: "text", required: false }
    ]
  });
}

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

async function captureDashboardSection(page, viewport, section) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector(".dashboard-shell", { timeout: 15000 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(220);

  const skipLinkVisible = await page.evaluate(() => {
    const skipLink = document.querySelector(".skip-link");
    if (!skipLink || document.activeElement !== skipLink) return false;
    const rect = skipLink.getBoundingClientRect();
    return rect.width > 20 && rect.height > 20 && rect.top >= 0;
  });

  const sectionButton = page.locator(`button[data-section="${section}"]`);
  await sectionButton.click();
  await page.waitForTimeout(260);

  if (section === "today") {
    await ensureTodayPlanForSmoke();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.waitForSelector(".dashboard-shell", { timeout: 15000 });
    await page.locator(`button[data-section="${section}"]`).click();
    await page.waitForTimeout(360);
  }

  if (section === "package") {
    const materials = await fetchJson(`${baseUrl}/api/materials`).catch(() => ({ drafts: [] }));
    const draftJobId = materials.drafts?.find((draft) => draft.jobId)?.jobId;
    if (draftJobId) {
      await page.locator(".package-toolbar select").selectOption(draftJobId).catch(() => null);
      await page.waitForTimeout(520);
    }
  }

  if (section === "sources") {
    const visualSourceName = `__careerpilot_smoke_visual_${viewport.name}`;
    const csvPath = path.join(outputDir, `${visualSourceName}.csv`);
    await fs.writeFile(
      csvPath,
      "市场,公司,岗位,地点,链接,描述,匹配分\nSG,Visual CSV Tech,Frontend Intern,Singapore,https://example.com/__careerpilot-smoke-visual-csv,React internship graduate friendly,81",
      "utf8"
    );
    await page.locator(".csv-file-panel input[type='file']").setInputFiles(csvPath);
    await page.locator(".csv-file-panel input:not([type='file'])").first().fill(visualSourceName);
    await page.waitForTimeout(320);
    await page.getByRole("button", { name: "导入 CSV 岗位" }).click();
    await page.waitForFunction(() => document.querySelector(".csv-file-status span")?.textContent?.includes("导入完成"), null, { timeout: 12000 });
  }

  if (section === "backup") {
    await page.waitForFunction(() => document.querySelectorAll(".health-check-card").length >= 4, null, { timeout: 12000 });
  }

  let globalSearchShortcutFocused = undefined;
  let globalSearchArrowSelectionMoved = undefined;
  if (section === "today") {
    await page.keyboard.press("Control+K");
    await page.waitForTimeout(120);
    globalSearchShortcutFocused = await page.evaluate(() => document.activeElement === document.querySelector(".global-search-panel input"));
    await page.getByLabel("全局搜索").fill("字节");
    await page.waitForFunction(() => document.querySelector(".global-search-count")?.textContent?.includes("命中"), null, { timeout: 5000 });
    const initialActiveText = await page.locator(".global-search-results button.active").first().textContent().catch(() => "");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(120);
    const movedActiveText = await page.locator(".global-search-results button.active").first().textContent().catch(() => "");
    globalSearchArrowSelectionMoved = Boolean(initialActiveText && movedActiveText && initialActiveText !== movedActiveText);
  }

  const result = await page.evaluate((activeSection) => {
    const activeButton = document.querySelector(`button[data-section="${activeSection}"].active`);
    const root = document.documentElement;
    const body = document.body;
    const horizontalOverflow = Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - root.clientWidth);
    const title = document.querySelector(".workbench-header h1")?.textContent?.trim() || "";
    const textLength = body.innerText.trim().length;
    const globalSearchPanel = Boolean(document.querySelector(".global-search-panel"));
    const globalSearchInputs = document.querySelectorAll(".global-search-panel input[aria-label='全局搜索']").length;
    const globalSearchResultButtons = document.querySelectorAll(".global-search-results button").length;
    const globalSearchActiveResultButtons = document.querySelectorAll(".global-search-results button.active").length;
    const globalSearchCountText = document.querySelector(".global-search-count")?.textContent?.trim() || "";
    const globalSearchQueryValue = document.querySelector(".global-search-panel input")?.value || "";
    const packageMaterialEditors = activeSection === "package" ? document.querySelectorAll(".package-draft textarea").length : undefined;
    const packageSaveDraftButtons =
      activeSection === "package"
        ? Array.from(document.querySelectorAll(".package-draft button")).filter((button) => button.textContent?.includes("保存草稿")).length
        : undefined;
    const packageSubmitChecklist = activeSection === "package" ? Boolean(document.querySelector(".package-submit-checklist")) : undefined;
    const packageSubmitChecklistItems = activeSection === "package" ? document.querySelectorAll(".submit-check-item").length : undefined;
    const packageCopyChecklistButtons =
      activeSection === "package"
        ? Array.from(document.querySelectorAll(".package-submit-checklist button")).filter((button) => button.textContent?.includes("复制清单")).length
        : undefined;
    const packageCopySummaryButtons =
      activeSection === "package"
        ? Array.from(document.querySelectorAll(".package-submit-checklist button")).filter((button) => button.textContent?.includes("复制投递包摘要")).length
        : undefined;
    const packageDownloadSummaryButtons =
      activeSection === "package"
        ? Array.from(document.querySelectorAll(".package-submit-checklist button")).filter((button) => button.textContent?.includes("下载摘要.md")).length
        : undefined;
    const packageSnapshotReplayPanel = activeSection === "package" ? Boolean(document.querySelector(".snapshot-replay-panel")) : undefined;
    const packageSnapshotReplayMetrics = activeSection === "package" ? document.querySelectorAll(".snapshot-replay-panel .metric-tile").length : undefined;
    const packageSnapshotReplayCopyButtons =
      activeSection === "package"
        ? Array.from(document.querySelectorAll(".snapshot-replay-panel button")).filter((button) => button.textContent?.includes("复制回放清单")).length
        : undefined;
    const packageSnapshotReplayDownloadButtons =
      activeSection === "package"
        ? Array.from(document.querySelectorAll(".snapshot-replay-panel button")).filter((button) => button.textContent?.includes("下载回放.md")).length
        : undefined;
    const packageDeepLinkReady = activeSection === "package" ? window.location.search.includes("section=package") || Boolean(document.querySelector(".package-toolbar select")) : undefined;
    const resumeEditorCards = activeSection === "materials" ? document.querySelectorAll(".resume-editor-card").length : undefined;
    const resumeEditorTextareas = activeSection === "materials" ? document.querySelectorAll(".resume-editor-card textarea").length : undefined;
    const resumeSaveButtons =
      activeSection === "materials"
        ? Array.from(document.querySelectorAll(".resume-editor-card button")).filter((button) => button.textContent?.includes("保存简历版本")).length
        : undefined;
    const sourceEditorCards = activeSection === "sources" ? document.querySelectorAll(".source-editor-card").length : undefined;
    const sourceSaveButtons =
      activeSection === "sources"
        ? Array.from(document.querySelectorAll(".source-editor-card button")).filter((button) => button.textContent?.includes("保存数据源")).length
        : undefined;
    const sourceCsvFileInputs = activeSection === "sources" ? document.querySelectorAll(".csv-file-panel input[type='file']").length : undefined;
    const sourceCsvImportButtons =
      activeSection === "sources"
        ? Array.from(document.querySelectorAll(".csv-file-panel button")).filter((button) => button.textContent?.includes("导入 CSV 岗位")).length
        : undefined;
    const sourceCsvFileStatus = activeSection === "sources" ? document.querySelector(".csv-file-status strong")?.textContent?.trim() || "" : undefined;
    const sourceCsvImportMessage = activeSection === "sources" ? document.querySelector(".csv-file-status span")?.textContent?.trim() || "" : undefined;
    const sourceCsvPreviewText = activeSection === "sources" ? document.querySelector(".csv-file-panel textarea")?.value || "" : undefined;
    const sourceSyncPanel = activeSection === "sources" ? Boolean(document.querySelector(".source-sync-panel")) : undefined;
    const sourceSyncMetrics = activeSection === "sources" ? document.querySelectorAll(".source-sync-panel .metric-tile").length : undefined;
    const sourceSyncButtons =
      activeSection === "sources"
        ? Array.from(document.querySelectorAll(".source-sync-panel button")).filter((button) => button.textContent?.includes("同步启用公开来源")).length
        : undefined;
    const sourceCardSyncButtons =
      activeSection === "sources"
        ? Array.from(document.querySelectorAll(".source-editor-card button")).filter((button) => button.textContent?.includes("同步此来源")).length
        : undefined;
    const jobEditorCards = activeSection === "markets" ? document.querySelectorAll(".job-editor-card").length : undefined;
    const jobSaveButtons =
      activeSection === "markets"
        ? Array.from(document.querySelectorAll(".job-editor-card button")).filter((button) => button.textContent?.includes("保存岗位")).length
        : undefined;
    const jobArchiveControls = activeSection === "markets" ? document.querySelectorAll(".job-archive-strip input[type='checkbox']").length : undefined;
    const jobQualityPanel = activeSection === "markets" ? Boolean(document.querySelector(".job-quality-panel")) : undefined;
    const jobQualityCards = activeSection === "markets" ? document.querySelectorAll(".job-quality-card").length : undefined;
    const jobQualityCopyButtons =
      activeSection === "markets"
        ? Array.from(document.querySelectorAll(".job-quality-panel button")).filter((button) => button.textContent?.includes("复制质量清单")).length
        : undefined;
    const jobCsvExportButtons =
      activeSection === "markets"
        ? Array.from(document.querySelectorAll(".job-quality-panel button")).filter((button) => button.textContent?.includes("导出岗位.csv")).length
        : undefined;
    const jobQualityFilterSelects = activeSection === "markets" ? document.querySelectorAll(".filter-bar select").length : undefined;
    const answerEditorCards = activeSection === "interviews" ? document.querySelectorAll(".answer-editor-card").length : undefined;
    const answerSensitivitySelects = activeSection === "interviews" ? document.querySelectorAll(".answer-editor-card select").length : undefined;
    const answerSaveButtons =
      activeSection === "interviews"
        ? Array.from(document.querySelectorAll(".answer-editor-card button")).filter((button) => button.textContent?.includes("保存答案")).length
        : undefined;
    const applicationNextActionInputs = activeSection === "applications" ? document.querySelectorAll(".application-card.editable input[placeholder*='下一步动作']").length : undefined;
    const applicationFollowUpDateInputs = activeSection === "applications" ? document.querySelectorAll(".application-card.editable .inline-date-field input[type='date']").length : undefined;
    const applicationFollowUpCalendarPanel = activeSection === "applications" ? Boolean(document.querySelector(".followup-calendar-panel")) : undefined;
    const applicationFollowUpCalendarMetrics = activeSection === "applications" ? document.querySelectorAll(".followup-calendar-summary .metric-tile").length : undefined;
    const applicationFollowUpDayCards = activeSection === "applications" ? document.querySelectorAll(".followup-day-card").length : undefined;
    const applicationFollowUpCopyButtons =
      activeSection === "applications"
        ? Array.from(document.querySelectorAll(".followup-calendar-panel button")).filter((button) => button.textContent?.includes("复制7日节奏")).length
        : undefined;
    const applicationFollowUpDownloadButtons =
      activeSection === "applications"
        ? Array.from(document.querySelectorAll(".followup-calendar-panel button")).filter((button) => button.textContent?.includes("下载7日节奏.md")).length
        : undefined;
    const applicationPipelineCsvButtons =
      activeSection === "applications"
        ? Array.from(document.querySelectorAll(".followup-calendar-panel button")).filter((button) => button.textContent?.includes("导出管线.csv")).length
        : undefined;
    const applicationScheduleMissingButtons =
      activeSection === "applications"
        ? Array.from(document.querySelectorAll(".followup-calendar-panel button")).filter((button) => button.textContent?.includes("一键排期未排期")).length
        : undefined;
    const applicationReviewPanel = activeSection === "applications" ? Boolean(document.querySelector(".pipeline-review-panel")) : undefined;
    const applicationReviewMetrics = activeSection === "applications" ? document.querySelectorAll(".pipeline-review-panel .metric-tile").length : undefined;
    const applicationReviewCopyButtons =
      activeSection === "applications"
        ? Array.from(document.querySelectorAll(".pipeline-review-panel button")).filter((button) => button.textContent?.includes("复制投递复盘")).length
        : undefined;
    const applicationMarketFunnelRows = activeSection === "applications" ? document.querySelectorAll(".market-funnel-row").length : undefined;
    const todayFollowUpPanel = activeSection === "today" ? Boolean(document.querySelector(".due-follow-panel")) : undefined;
    const todayRefreshPanel = activeSection === "today" ? Boolean(document.querySelector(".daily-refresh-panel")) : undefined;
    const todayRefreshMetrics = activeSection === "today" ? document.querySelectorAll(".daily-refresh-panel .metric-tile").length : undefined;
    const todayRefreshButtons =
      activeSection === "today"
        ? Array.from(document.querySelectorAll(".daily-refresh-panel button")).filter((button) => button.textContent?.includes("刷新公开来源")).length
        : undefined;
    const todayOpenSourcesButtons =
      activeSection === "today"
        ? Array.from(document.querySelectorAll(".daily-refresh-panel button")).filter((button) => button.textContent?.includes("管理数据源")).length
        : undefined;
    const todayProgressPanel = activeSection === "today" ? Boolean(document.querySelector(".daily-progress-panel")) : undefined;
    const todayProgressMetrics = activeSection === "today" ? document.querySelectorAll(".daily-progress-panel .metric-tile").length : undefined;
    const todayTaskCards = activeSection === "today" ? document.querySelectorAll(".task-card").length : undefined;
    const todayActionPanel = activeSection === "today" ? Boolean(document.querySelector(".daily-action-panel")) : undefined;
    const todayActionCards = activeSection === "today" ? document.querySelectorAll(".daily-action-card").length : undefined;
    const todayCopyActionQueueButtons =
      activeSection === "today"
        ? Array.from(document.querySelectorAll(".daily-action-panel button")).filter((button) => button.textContent?.includes("复制行动队列")).length
        : undefined;
    const todayOpenFirstActionButtons =
      activeSection === "today"
        ? Array.from(document.querySelectorAll(".daily-action-panel button")).filter((button) => button.textContent?.includes("打开第一项")).length
        : undefined;
    const todayCopyPlanButtons =
      activeSection === "today"
        ? Array.from(document.querySelectorAll(".daily-plan-actions button")).filter((button) => button.textContent?.includes("复制今日计划")).length
        : undefined;
    const todayDownloadPlanButtons =
      activeSection === "today"
        ? Array.from(document.querySelectorAll(".daily-plan-actions button")).filter((button) => button.textContent?.includes("下载今日计划.md")).length
        : undefined;
    const backupHealthPanel = activeSection === "backup" ? Boolean(document.querySelector(".local-health-panel")) : undefined;
    const backupHealthCards = activeSection === "backup" ? document.querySelectorAll(".health-check-card").length : undefined;
    const backupMaintenanceCommands = activeSection === "backup" ? document.querySelector(".maintenance-command-panel code")?.textContent || "" : undefined;
    const backupCopyMaintenanceButtons =
      activeSection === "backup"
        ? Array.from(document.querySelectorAll(".maintenance-command-panel button")).filter((button) => button.textContent?.includes("复制维护命令")).length
        : undefined;
    const setupChecklistPanel = Boolean(document.querySelector(".setup-checklist-panel"));
    const setupChecklistCards = document.querySelectorAll(".setup-check-card").length;
    const setupChecklistCopyButtons =
      Array.from(document.querySelectorAll(".setup-checklist-panel button")).filter((button) => button.textContent?.includes("复制启用清单")).length;
    const setupChecklistNextButtons =
      Array.from(document.querySelectorAll(".setup-checklist-actions button")).filter((button) => !button.textContent?.includes("复制启用清单")).length;
    const localRunStatusPanel = Boolean(document.querySelector(".local-run-status"));
    const localRunStatusCards = document.querySelectorAll(".local-run-card").length;
    const localRunStatusCopyButtons = Array.from(document.querySelectorAll(".local-run-status button")).filter((button) => button.textContent?.includes("复制运行状态")).length;
    const profileReadinessPanel = activeSection === "autofill" ? Boolean(document.querySelector(".profile-readiness-panel")) : undefined;
    const profileCompletionCards = activeSection === "autofill" ? document.querySelectorAll(".profile-completion-card").length : undefined;
    const profileAddTemplateButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".profile-readiness-panel button")).filter((button) => button.textContent?.includes("补齐常见字段")).length
        : undefined;
    const profileCopyGapButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".profile-readiness-panel button")).filter((button) => button.textContent?.includes("复制缺口清单")).length
        : undefined;
    const profilePackPanel = activeSection === "autofill" ? Boolean(document.querySelector(".profile-pack-panel")) : undefined;
    const profilePackMetricTiles = activeSection === "autofill" ? document.querySelectorAll(".profile-pack-panel .metric-tile").length : undefined;
    const profilePackCopyButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".profile-pack-panel button")).filter((button) => button.textContent?.includes("复制")).length
        : undefined;
    const profilePackDownloadButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".profile-pack-panel button")).filter((button) => button.textContent?.includes("下载速查.md")).length
        : undefined;
    const mappingLearningPanel = activeSection === "autofill" ? Boolean(document.querySelector(".mapping-learning-panel")) : undefined;
    const mappingLearningMetricTiles = activeSection === "autofill" ? document.querySelectorAll(".mapping-learning-panel .metric-tile").length : undefined;
    const mappingLearningBatchButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".mapping-learning-panel button")).filter((button) => button.textContent?.includes("批量保存安全建议")).length
        : undefined;
    const mappingSuggestionBadges = activeSection === "autofill" ? document.querySelectorAll(".mapping-suggestion-strip span").length : undefined;
    const autofillSnapshotReplayPanel = activeSection === "autofill" ? Boolean(document.querySelector(".snapshot-replay-panel")) : undefined;
    const autofillSnapshotReplayMetrics = activeSection === "autofill" ? document.querySelectorAll(".snapshot-replay-panel .metric-tile").length : undefined;
    const autofillSnapshotReplayCopyButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".snapshot-replay-panel button")).filter((button) => button.textContent?.includes("复制回放清单")).length
        : undefined;
    const autofillSnapshotReplayDownloadButtons =
      activeSection === "autofill"
        ? Array.from(document.querySelectorAll(".snapshot-replay-panel button")).filter((button) => button.textContent?.includes("下载回放.md")).length
        : undefined;

    const clipped = Array.from(document.querySelectorAll("button, a, .soft-pill, .status-pill, .answer-chip, .status-chip, .run-strip span, .workflow-ribbon, .setup-check-card, .empty-state"))
      .filter((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        return element.scrollWidth > Math.ceil(element.clientWidth) + 2 || element.scrollHeight > Math.ceil(element.clientHeight) + 2;
      })
      .slice(0, 8)
      .map((node) => ({
        text: node.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || node.className,
        width: node.clientWidth,
        scrollWidth: node.scrollWidth,
        height: node.clientHeight,
        scrollHeight: node.scrollHeight
      }));
    const unlabeledControls = Array.from(document.querySelectorAll("button, a"))
      .filter((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        const accessibleName = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim();
        return !accessibleName;
      })
      .slice(0, 8)
      .map((node) => node.outerHTML.slice(0, 120));

    return {
      title,
      textLength,
      activeButton: Boolean(activeButton),
      horizontalOverflow,
      globalSearchPanel,
      globalSearchInputs,
      globalSearchResultButtons,
      globalSearchActiveResultButtons,
      globalSearchCountText,
      globalSearchQueryValue,
      packageMaterialEditors,
      packageSaveDraftButtons,
      packageSubmitChecklist,
      packageSubmitChecklistItems,
      packageCopyChecklistButtons,
      packageCopySummaryButtons,
      packageDownloadSummaryButtons,
      packageSnapshotReplayPanel,
      packageSnapshotReplayMetrics,
      packageSnapshotReplayCopyButtons,
      packageSnapshotReplayDownloadButtons,
      packageDeepLinkReady,
      resumeEditorCards,
      resumeEditorTextareas,
      resumeSaveButtons,
      sourceEditorCards,
      sourceSaveButtons,
      sourceCsvFileInputs,
      sourceCsvImportButtons,
      sourceCsvFileStatus,
      sourceCsvImportMessage,
      sourceCsvPreviewText,
      sourceSyncPanel,
      sourceSyncMetrics,
      sourceSyncButtons,
      sourceCardSyncButtons,
      jobEditorCards,
      jobSaveButtons,
      jobArchiveControls,
      jobQualityPanel,
      jobQualityCards,
      jobQualityCopyButtons,
      jobCsvExportButtons,
      jobQualityFilterSelects,
      answerEditorCards,
      answerSensitivitySelects,
      answerSaveButtons,
      applicationNextActionInputs,
      applicationFollowUpDateInputs,
      applicationFollowUpCalendarPanel,
      applicationFollowUpCalendarMetrics,
      applicationFollowUpDayCards,
      applicationFollowUpCopyButtons,
      applicationFollowUpDownloadButtons,
      applicationPipelineCsvButtons,
      applicationScheduleMissingButtons,
      applicationReviewPanel,
      applicationReviewMetrics,
      applicationReviewCopyButtons,
      applicationMarketFunnelRows,
      todayFollowUpPanel,
      todayRefreshPanel,
      todayRefreshMetrics,
      todayRefreshButtons,
      todayOpenSourcesButtons,
      todayProgressPanel,
      todayProgressMetrics,
      todayTaskCards,
      todayActionPanel,
      todayActionCards,
      todayCopyActionQueueButtons,
      todayOpenFirstActionButtons,
      todayCopyPlanButtons,
      todayDownloadPlanButtons,
      backupHealthPanel,
      backupHealthCards,
      backupMaintenanceCommands,
      backupCopyMaintenanceButtons,
      setupChecklistPanel,
      setupChecklistCards,
      setupChecklistCopyButtons,
      setupChecklistNextButtons,
      localRunStatusPanel,
      localRunStatusCards,
      localRunStatusCopyButtons,
      profileReadinessPanel,
      profileCompletionCards,
      profileAddTemplateButtons,
      profileCopyGapButtons,
      profilePackPanel,
      profilePackMetricTiles,
      profilePackCopyButtons,
      profilePackDownloadButtons,
      mappingLearningPanel,
      mappingLearningMetricTiles,
      mappingLearningBatchButtons,
      mappingSuggestionBadges,
      autofillSnapshotReplayPanel,
      autofillSnapshotReplayMetrics,
      autofillSnapshotReplayCopyButtons,
      autofillSnapshotReplayDownloadButtons,
      clipped,
      unlabeledControls
    };
  }, section);

  result.skipLinkVisible = skipLinkVisible;
  result.globalSearchShortcutFocused = globalSearchShortcutFocused;
  result.globalSearchArrowSelectionMoved = globalSearchArrowSelectionMoved;

  assert(result.activeButton, `[${viewport.name}/${section}] Active navigation button was not set.`);
  assert(result.skipLinkVisible, `[${viewport.name}/${section}] Skip link was not keyboard-focusable and visible.`);
  assert(result.title.length > 0, `[${viewport.name}/${section}] Missing section title.`);
  assert(result.textLength > 80, `[${viewport.name}/${section}] First screen appears blank.`);
  assert(result.globalSearchPanel === true, `[${viewport.name}/${section}] Global search panel is missing.`);
  assert(result.globalSearchInputs >= 1, `[${viewport.name}/${section}] Global search input is missing.`);
  assert(result.globalSearchResultButtons >= 1, `[${viewport.name}/${section}] Global search results are missing.`);
  if (section === "today") {
    assert(result.globalSearchQueryValue === "字节", `[${viewport.name}/${section}] Global search query was not entered.`);
    assert(result.globalSearchCountText.includes("命中"), `[${viewport.name}/${section}] Global search did not report hits.`);
    assert(result.globalSearchShortcutFocused === true, `[${viewport.name}/${section}] Global search keyboard shortcut did not focus the input.`);
    assert(result.globalSearchActiveResultButtons === 1, `[${viewport.name}/${section}] Global search should have exactly one active result.`);
    assert(result.globalSearchArrowSelectionMoved === true, `[${viewport.name}/${section}] Global search arrow key did not move active result.`);
  }
  assert(result.setupChecklistPanel === true, `[${viewport.name}/${section}] Setup checklist panel is missing.`);
  assert(result.setupChecklistCards >= 6, `[${viewport.name}/${section}] Setup checklist cards are incomplete.`);
  assert(result.setupChecklistCopyButtons >= 1, `[${viewport.name}/${section}] Setup checklist copy action is missing.`);
  assert(result.setupChecklistNextButtons >= 1, `[${viewport.name}/${section}] Setup checklist next action is missing.`);
  assert(result.localRunStatusPanel === true, `[${viewport.name}/${section}] Local run status bar is missing.`);
  assert(result.localRunStatusCards >= 5, `[${viewport.name}/${section}] Local run status cards are incomplete.`);
  assert(result.localRunStatusCopyButtons >= 1, `[${viewport.name}/${section}] Local run status copy action is missing.`);
  if (section === "today") {
    assert(result.todayRefreshPanel === true, `[${viewport.name}/${section}] Daily source refresh panel is missing.`);
    assert(result.todayRefreshMetrics >= 4, `[${viewport.name}/${section}] Daily source refresh metrics are incomplete.`);
    assert(result.todayRefreshButtons >= 1, `[${viewport.name}/${section}] Daily source refresh action is missing.`);
    assert(result.todayOpenSourcesButtons >= 1, `[${viewport.name}/${section}] Daily source management action is missing.`);
    assert(result.todayFollowUpPanel === true, `[${viewport.name}/${section}] Today follow-up panel is missing.`);
    assert(result.todayProgressPanel === true, `[${viewport.name}/${section}] Today progress panel is missing.`);
    assert(result.todayProgressMetrics >= 5, `[${viewport.name}/${section}] Today progress metrics are incomplete.`);
    assert(result.todayTaskCards >= 1, `[${viewport.name}/${section}] Today task cards are missing.`);
    assert(result.todayActionPanel === true, `[${viewport.name}/${section}] Today action queue panel is missing.`);
    assert(result.todayActionCards >= 1, `[${viewport.name}/${section}] Today action queue cards are missing.`);
    assert(result.todayCopyActionQueueButtons >= 1, `[${viewport.name}/${section}] Today action queue copy action is missing.`);
    assert(result.todayOpenFirstActionButtons >= 1, `[${viewport.name}/${section}] Today first-action shortcut is missing.`);
    assert(result.todayCopyPlanButtons >= 1, `[${viewport.name}/${section}] Today plan copy action is missing.`);
    assert(result.todayDownloadPlanButtons >= 1, `[${viewport.name}/${section}] Today plan download action is missing.`);
  }
  if (section === "package") {
    assert(result.packageMaterialEditors >= 1, `[${viewport.name}/${section}] Package material drafts are not editable.`);
    assert(result.packageSaveDraftButtons >= 1, `[${viewport.name}/${section}] Package material save action is missing.`);
    assert(result.packageSubmitChecklist === true, `[${viewport.name}/${section}] Package submit checklist is missing.`);
    assert(result.packageSubmitChecklistItems >= 6, `[${viewport.name}/${section}] Package submit checklist is incomplete.`);
    assert(result.packageCopyChecklistButtons >= 1, `[${viewport.name}/${section}] Package checklist copy action is missing.`);
    assert(result.packageCopySummaryButtons >= 1, `[${viewport.name}/${section}] Package summary copy action is missing.`);
    assert(result.packageDownloadSummaryButtons >= 1, `[${viewport.name}/${section}] Package summary download action is missing.`);
    assert(result.packageSnapshotReplayPanel === true, `[${viewport.name}/${section}] Package snapshot replay panel is missing.`);
    assert(result.packageSnapshotReplayMetrics >= 4, `[${viewport.name}/${section}] Package snapshot replay metrics are incomplete.`);
    assert(result.packageSnapshotReplayCopyButtons >= 1, `[${viewport.name}/${section}] Package snapshot replay copy action is missing.`);
    assert(result.packageSnapshotReplayDownloadButtons >= 1, `[${viewport.name}/${section}] Package snapshot replay download action is missing.`);
    assert(result.packageDeepLinkReady === true, `[${viewport.name}/${section}] Package deep-link target is not available.`);
  }
  if (section === "materials") {
    assert(result.resumeEditorCards >= 1, `[${viewport.name}/${section}] Resume editor cards are missing.`);
    assert(result.resumeEditorTextareas >= 1, `[${viewport.name}/${section}] Resume content editor is missing.`);
    assert(result.resumeSaveButtons >= 1, `[${viewport.name}/${section}] Resume save action is missing.`);
  }
  if (section === "sources") {
    assert(result.sourceEditorCards >= 1, `[${viewport.name}/${section}] Source editor cards are missing.`);
    assert(result.sourceSaveButtons >= 1, `[${viewport.name}/${section}] Source save action is missing.`);
    assert(result.sourceCsvFileInputs >= 1, `[${viewport.name}/${section}] CSV file input is missing.`);
    assert(result.sourceCsvImportButtons >= 1, `[${viewport.name}/${section}] CSV import action is missing.`);
    assert(result.sourceCsvFileStatus?.includes(`__careerpilot_smoke_visual_${viewport.name}.csv`), `[${viewport.name}/${section}] CSV file selection was not reflected in the UI.`);
    assert(result.sourceCsvImportMessage?.includes("导入完成"), `[${viewport.name}/${section}] CSV import result was not reflected in the UI.`);
    assert(result.sourceCsvPreviewText?.includes("Visual CSV Tech"), `[${viewport.name}/${section}] CSV file contents were not loaded into the preview.`);
    assert(result.sourceSyncPanel === true, `[${viewport.name}/${section}] Source sync panel is missing.`);
    assert(result.sourceSyncMetrics >= 4, `[${viewport.name}/${section}] Source sync metrics are incomplete.`);
    assert(result.sourceSyncButtons >= 1, `[${viewport.name}/${section}] Source sync action is missing.`);
    assert(result.sourceCardSyncButtons >= 1, `[${viewport.name}/${section}] Source card sync action is missing.`);
  }
  if (section === "markets") {
    assert(result.jobQualityPanel === true, `[${viewport.name}/${section}] Job quality panel is missing.`);
    assert(result.jobQualityCards >= 6, `[${viewport.name}/${section}] Job quality cards are incomplete.`);
    assert(result.jobQualityCopyButtons >= 1, `[${viewport.name}/${section}] Job quality report copy action is missing.`);
    assert(result.jobCsvExportButtons >= 1, `[${viewport.name}/${section}] Job CSV export action is missing.`);
    assert(result.jobQualityFilterSelects >= 3, `[${viewport.name}/${section}] Job quality filter controls are incomplete.`);
    assert(result.jobEditorCards >= 1, `[${viewport.name}/${section}] Job editor cards are missing.`);
    assert(result.jobSaveButtons >= 1, `[${viewport.name}/${section}] Job save action is missing.`);
    assert(result.jobArchiveControls >= 1, `[${viewport.name}/${section}] Job archive control is missing.`);
  }
  if (section === "interviews") {
    assert(result.answerEditorCards >= 1, `[${viewport.name}/${section}] Answer editor cards are missing.`);
    assert(result.answerSensitivitySelects >= 1, `[${viewport.name}/${section}] Answer metadata editors are missing.`);
    assert(result.answerSaveButtons >= 1, `[${viewport.name}/${section}] Answer save action is missing.`);
  }
  if (section === "applications") {
    assert(result.applicationNextActionInputs >= 1, `[${viewport.name}/${section}] Application next-action editor is missing.`);
    assert(result.applicationFollowUpDateInputs >= 1, `[${viewport.name}/${section}] Application follow-up date editor is missing.`);
    assert(result.applicationFollowUpCalendarPanel === true, `[${viewport.name}/${section}] Application 7-day follow-up panel is missing.`);
    assert(result.applicationFollowUpCalendarMetrics >= 4, `[${viewport.name}/${section}] Application follow-up metrics are incomplete.`);
    assert(result.applicationFollowUpDayCards >= 7, `[${viewport.name}/${section}] Application follow-up day cards are incomplete.`);
    assert(result.applicationFollowUpCopyButtons >= 1, `[${viewport.name}/${section}] Application follow-up copy action is missing.`);
    assert(result.applicationFollowUpDownloadButtons >= 1, `[${viewport.name}/${section}] Application follow-up download action is missing.`);
    assert(result.applicationPipelineCsvButtons >= 1, `[${viewport.name}/${section}] Application pipeline CSV export action is missing.`);
    assert(result.applicationScheduleMissingButtons >= 1, `[${viewport.name}/${section}] Application missing follow-up schedule action is missing.`);
    assert(result.applicationReviewPanel === true, `[${viewport.name}/${section}] Application review panel is missing.`);
    assert(result.applicationReviewMetrics >= 4, `[${viewport.name}/${section}] Application review metrics are incomplete.`);
    assert(result.applicationReviewCopyButtons >= 1, `[${viewport.name}/${section}] Application review copy action is missing.`);
    assert(result.applicationMarketFunnelRows >= 1, `[${viewport.name}/${section}] Application market funnel rows are missing.`);
  }
  if (section === "autofill") {
    assert(result.profileReadinessPanel === true, `[${viewport.name}/${section}] Profile readiness panel is missing.`);
    assert(result.profileCompletionCards >= 6, `[${viewport.name}/${section}] Profile completion groups are incomplete.`);
    assert(result.profileAddTemplateButtons >= 1, `[${viewport.name}/${section}] Profile template add action is missing.`);
    assert(result.profileCopyGapButtons >= 1, `[${viewport.name}/${section}] Profile gap copy action is missing.`);
    assert(result.profilePackPanel === true, `[${viewport.name}/${section}] Profile quick-reference pack panel is missing.`);
    assert(result.profilePackMetricTiles >= 3, `[${viewport.name}/${section}] Profile quick-reference metrics are incomplete.`);
    assert(result.profilePackCopyButtons >= 3, `[${viewport.name}/${section}] Profile quick-reference copy actions are missing.`);
    assert(result.profilePackDownloadButtons >= 1, `[${viewport.name}/${section}] Profile quick-reference download action is missing.`);
    assert(result.mappingLearningPanel === true, `[${viewport.name}/${section}] Mapping learning panel is missing.`);
    assert(result.mappingLearningMetricTiles >= 3, `[${viewport.name}/${section}] Mapping learning metrics are incomplete.`);
    assert(result.mappingLearningBatchButtons >= 1, `[${viewport.name}/${section}] Mapping batch-save action is missing.`);
    assert(result.autofillSnapshotReplayPanel === true, `[${viewport.name}/${section}] Autofill snapshot replay panel is missing.`);
    assert(result.autofillSnapshotReplayMetrics >= 4, `[${viewport.name}/${section}] Autofill snapshot replay metrics are incomplete.`);
    assert(result.autofillSnapshotReplayCopyButtons >= 1, `[${viewport.name}/${section}] Autofill snapshot replay copy action is missing.`);
    assert(result.autofillSnapshotReplayDownloadButtons >= 1, `[${viewport.name}/${section}] Autofill snapshot replay download action is missing.`);
  }
  if (section === "backup") {
    assert(result.backupHealthPanel === true, `[${viewport.name}/${section}] Local health panel is missing.`);
    assert(result.backupHealthCards >= 4, `[${viewport.name}/${section}] Local health checks are incomplete.`);
    assert(result.backupMaintenanceCommands?.includes("npm run verify"), `[${viewport.name}/${section}] Maintenance commands are missing verify.`);
    assert(result.backupMaintenanceCommands?.includes("smoke:cleanup"), `[${viewport.name}/${section}] Maintenance commands are missing smoke cleanup.`);
    assert(result.backupCopyMaintenanceButtons >= 1, `[${viewport.name}/${section}] Maintenance command copy action is missing.`);
  }
  assert(result.horizontalOverflow <= 2, `[${viewport.name}/${section}] Horizontal overflow: ${result.horizontalOverflow}px.`);
  assert(result.clipped.length === 0, `[${viewport.name}/${section}] Clipped controls: ${JSON.stringify(result.clipped)}`);
  assert(result.unlabeledControls.length === 0, `[${viewport.name}/${section}] Unlabeled controls: ${JSON.stringify(result.unlabeledControls)}`);

  const screenshot = `dashboard-${viewport.name}-${section}.png`;
  await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
  const todayDownload = section === "today" ? await verifyTodayPlanDownload(page, viewport) : {};
  const globalSearchKeyboard = section === "today" ? await verifyGlobalSearchKeyboardOpen(page, viewport) : {};
  const packageDownload = section === "package" ? await verifyPackageSummaryDownload(page, viewport) : {};
  const packageReplayDownload = section === "package" ? await verifySnapshotReplayDownload(page, viewport, "package") : {};
  const applicationFollowUpDownload = section === "applications" ? await verifyFollowUpPlanDownload(page, viewport) : {};
  const applicationPipelineCsvDownload = section === "applications" ? await verifyPipelineCsvDownload(page, viewport) : {};
  const jobCsvDownload = section === "markets" ? await verifyJobsCsvDownload(page, viewport) : {};
  const profilePackDownload = section === "autofill" ? await verifyProfilePackDownload(page, viewport) : {};
  const autofillReplayDownload = section === "autofill" ? await verifySnapshotReplayDownload(page, viewport, "autofill") : {};
  return { type: "dashboard", viewport: viewport.name, section, screenshot, ...result, ...todayDownload, ...globalSearchKeyboard, ...packageDownload, ...packageReplayDownload, ...applicationFollowUpDownload, ...applicationPipelineCsvDownload, ...jobCsvDownload, ...profilePackDownload, ...autofillReplayDownload };
}

async function verifyTodayPlanDownload(page, viewport) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "下载今日计划.md" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";
  const hasBoundary = content.includes("不自动投递") && content.includes("CareerPilot APAC");

  await download.delete().catch(() => null);
  assert(filename.endsWith(".md"), `[${viewport.name}/today] Today plan download should be a markdown file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/today] Today plan filename should use local date, got ${filename}.`);
  assert(content.length > 450, `[${viewport.name}/today] Today plan download is too small.`);
  assert(content.includes("今日短名单"), `[${viewport.name}/today] Today plan download is missing task shortlist.`);
  assert(hasBoundary, `[${viewport.name}/today] Today plan download is missing operation boundaries.`);

  return {
    todayDownloadedPlanFilename: filename,
    todayDownloadedPlanBytes: content.length,
    todayDownloadedPlanHasBoundary: hasBoundary
  };
}

async function verifyGlobalSearchKeyboardOpen(page, viewport) {
  await page.keyboard.press("Control+K");
  await page.waitForTimeout(120);
  const shortcutFocused = await page.evaluate(() => document.activeElement === document.querySelector(".global-search-panel input"));
  await page.getByLabel("全局搜索").fill("字节");
  await page.waitForFunction(() => document.querySelectorAll(".global-search-results button").length >= 2, null, { timeout: 5000 });
  const initialActiveText = await page.locator(".global-search-results button.active").first().textContent().catch(() => "");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(120);
  const movedActiveText = await page.locator(".global-search-results button.active").first().textContent().catch(() => "");
  const arrowMoved = Boolean(initialActiveText && movedActiveText && initialActiveText !== movedActiveText);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".workbench-header h1")?.textContent?.trim() === "投递包", null, { timeout: 8000 });
  const openedPackage = await page.evaluate(() => document.querySelector(".workbench-header h1")?.textContent?.trim() === "投递包");

  assert(shortcutFocused, `[${viewport.name}/today] Global search shortcut did not focus input before Enter.`);
  assert(arrowMoved, `[${viewport.name}/today] Global search arrow key did not move the active result before Enter.`);
  assert(openedPackage, `[${viewport.name}/today] Global search Enter did not open the active package result.`);

  return {
    globalSearchKeyboardShortcutFocused: shortcutFocused,
    globalSearchKeyboardArrowMoved: arrowMoved,
    globalSearchEnterOpenedPackage: openedPackage
  };
}

async function verifyFollowUpPlanDownload(page, viewport) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "下载7日节奏.md" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";
  const hasBoundary = content.includes("不自动投递") && content.includes("不自动提交") && content.includes("CareerPilot APAC");

  await download.delete().catch(() => null);
  assert(filename.endsWith(".md"), `[${viewport.name}/applications] Follow-up plan download should be a markdown file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/applications] Follow-up filename should use local date, got ${filename}.`);
  assert(content.length > 420, `[${viewport.name}/applications] Follow-up plan download is too small.`);
  assert(content.includes("7日跟进节奏"), `[${viewport.name}/applications] Follow-up plan download is missing title.`);
  assert(content.includes("未来 7 天"), `[${viewport.name}/applications] Follow-up plan download is missing calendar section.`);
  assert(hasBoundary, `[${viewport.name}/applications] Follow-up plan download is missing operation boundaries.`);

  return {
    applicationDownloadedFollowUpFilename: filename,
    applicationDownloadedFollowUpBytes: content.length,
    applicationDownloadedFollowUpHasBoundary: hasBoundary
  };
}

async function verifyPipelineCsvDownload(page, viewport) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "导出管线.csv" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";

  await download.delete().catch(() => null);
  assert(filename.endsWith(".csv"), `[${viewport.name}/applications] Pipeline export should be a CSV file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/applications] Pipeline CSV filename should use local date, got ${filename}.`);
  assert(content.length > 120, `[${viewport.name}/applications] Pipeline CSV export is too small.`);
  assert(content.includes("市场") && content.includes("状态") && content.includes("下一步动作"), `[${viewport.name}/applications] Pipeline CSV export is missing core columns.`);

  return {
    applicationDownloadedPipelineCsvFilename: filename,
    applicationDownloadedPipelineCsvBytes: content.length
  };
}

async function verifyJobsCsvDownload(page, viewport) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "导出岗位.csv" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";

  await download.delete().catch(() => null);
  assert(filename.endsWith(".csv"), `[${viewport.name}/markets] Jobs export should be a CSV file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/markets] Jobs CSV filename should use local date, got ${filename}.`);
  assert(content.length > 160, `[${viewport.name}/markets] Jobs CSV export is too small.`);
  assert(content.includes("市场") && content.includes("匹配分") && content.includes("质量问题"), `[${viewport.name}/markets] Jobs CSV export is missing core columns.`);

  return {
    marketDownloadedJobsCsvFilename: filename,
    marketDownloadedJobsCsvBytes: content.length
  };
}

async function verifyPackageSummaryDownload(page, viewport) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "下载摘要.md" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";
  const hasBoundary = content.includes("不自动提交") && content.includes("CareerPilot APAC");

  await download.delete().catch(() => null);
  assert(filename.endsWith(".md"), `[${viewport.name}/package] Package summary download should be a markdown file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/package] Package summary filename should use local date, got ${filename}.`);
  assert(content.length > 600, `[${viewport.name}/package] Package summary download is too small.`);
  assert(hasBoundary, `[${viewport.name}/package] Package summary download is missing operation boundaries.`);

  return {
    packageDownloadedSummaryFilename: filename,
    packageDownloadedSummaryBytes: content.length,
    packageDownloadedSummaryHasBoundary: hasBoundary
  };
}

async function verifySnapshotReplayDownload(page, viewport, section) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "下载回放.md" }).first().click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";
  const hasBoundary = content.includes("不自动提交") && content.includes("不绕验证码") && content.includes("表单回放清单");

  await download.delete().catch(() => null);
  assert(filename.endsWith(".md"), `[${viewport.name}/${section}] Snapshot replay download should be a markdown file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/${section}] Snapshot replay filename should use local date, got ${filename}.`);
  assert(content.length > 360, `[${viewport.name}/${section}] Snapshot replay download is too small.`);
  assert(content.includes("可直接填写"), `[${viewport.name}/${section}] Snapshot replay download is missing fillable fields section.`);
  assert(content.includes("待人工确认"), `[${viewport.name}/${section}] Snapshot replay download is missing review section.`);
  assert(content.includes("缺映射/缺值"), `[${viewport.name}/${section}] Snapshot replay download is missing gap section.`);
  assert(hasBoundary, `[${viewport.name}/${section}] Snapshot replay download is missing operation boundaries.`);

  return {
    [`${section}DownloadedSnapshotReplayFilename`]: filename,
    [`${section}DownloadedSnapshotReplayBytes`]: content.length,
    [`${section}DownloadedSnapshotReplayHasBoundary`]: hasBoundary
  };
}

async function verifyProfilePackDownload(page, viewport) {
  const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
  await page.getByRole("button", { name: "下载速查.md" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const filePath = await download.path();
  const content = filePath ? await fs.readFile(filePath, "utf8") : "";
  const hasBoundary = content.includes("不自动提交") && content.includes("敏感字段提醒") && content.includes("填表速查包");

  await download.delete().catch(() => null);
  assert(filename.endsWith(".md"), `[${viewport.name}/autofill] Profile pack download should be a markdown file, got ${filename}.`);
  assert(filename.startsWith(localDateKey()), `[${viewport.name}/autofill] Profile pack filename should use local date, got ${filename}.`);
  assert(content.length > 500, `[${viewport.name}/autofill] Profile pack download is too small.`);
  assert(hasBoundary, `[${viewport.name}/autofill] Profile pack download is missing safety boundaries.`);

  return {
    profileDownloadedPackFilename: filename,
    profileDownloadedPackBytes: content.length,
    profileDownloadedPackHasBoundary: hasBoundary
  };
}

async function captureAtsPage(page, viewport, target) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}${target.url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".ats-lab-panel", { timeout: 15000 });

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const horizontalOverflow = Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - root.clientWidth);
    const fieldCount = document.querySelectorAll("input, textarea, select").length;
    const title = document.querySelector(".ats-lab-panel h1")?.textContent?.trim() || "";
    const vendor = document.querySelector(".ats-lab-page")?.getAttribute("data-careerpilot-ats") || "";
    const clipped = Array.from(document.querySelectorAll(".ats-lab-tabs a, .ats-lab-panel button"))
      .filter((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        return element.scrollWidth > Math.ceil(element.clientWidth) + 2 || element.scrollHeight > Math.ceil(element.clientHeight) + 2;
      })
      .slice(0, 8)
      .map((node) => node.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || node.className);
    const unlabeledControls = Array.from(document.querySelectorAll(".ats-lab-tabs a, .ats-lab-panel button"))
      .filter((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        const accessibleName = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim();
        return !accessibleName;
      })
      .slice(0, 8)
      .map((node) => node.outerHTML.slice(0, 120));

    return { title, vendor, fieldCount, horizontalOverflow, clipped, unlabeledControls };
  });

  assert(result.title.length > 0, `[${viewport.name}/${target.name}] Missing ATS title.`);
  assert(result.vendor === target.expectedVendor, `[${viewport.name}/${target.name}] Expected ATS vendor ${target.expectedVendor}, got ${result.vendor}.`);
  assert(result.fieldCount >= 18, `[${viewport.name}/${target.name}] Expected rich ATS form, got ${result.fieldCount} fields.`);
  assert(result.horizontalOverflow <= 2, `[${viewport.name}/${target.name}] Horizontal overflow: ${result.horizontalOverflow}px.`);
  assert(result.clipped.length === 0, `[${viewport.name}/${target.name}] Clipped controls: ${JSON.stringify(result.clipped)}`);
  assert(result.unlabeledControls.length === 0, `[${viewport.name}/${target.name}] Unlabeled controls: ${JSON.stringify(result.unlabeledControls)}`);

  const screenshot = `${target.name}-${viewport.name}.png`;
  await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
  return { type: "ats", viewport: viewport.name, page: target.name, screenshot, ...result };
}

async function captureStandalonePage(page, viewport, target) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${baseUrl}${target.url}`, { waitUntil: "networkidle" });
  await page.waitForSelector(target.selector, { timeout: 15000 });

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const horizontalOverflow = Math.max(root.scrollWidth - root.clientWidth, body.scrollWidth - root.clientWidth);
    const title = document.querySelector("h1")?.textContent?.trim() || "";
    const textLength = body.innerText.trim().length;
    const clipped = Array.from(document.querySelectorAll("button, a, .soft-pill, .status-pill, .chip-list span, .token-card, .component-spec-card, .empty-state"))
      .filter((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        return element.scrollWidth > Math.ceil(element.clientWidth) + 2 || element.scrollHeight > Math.ceil(element.clientHeight) + 2;
      })
      .slice(0, 8)
      .map((node) => node.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || node.className);
    const unlabeledControls = Array.from(document.querySelectorAll("button, a"))
      .filter((node) => {
        const element = node;
        const rect = element.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        const accessibleName = element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent?.trim();
        return !accessibleName;
      })
      .slice(0, 8)
      .map((node) => node.outerHTML.slice(0, 120));

    return { title, textLength, horizontalOverflow, clipped, unlabeledControls };
  });

  assert(result.title.length > 0, `[${viewport.name}/${target.name}] Missing page title.`);
  assert(result.textLength >= target.minTextLength, `[${viewport.name}/${target.name}] Page appears incomplete: ${result.textLength} chars.`);
  assert(result.horizontalOverflow <= 2, `[${viewport.name}/${target.name}] Horizontal overflow: ${result.horizontalOverflow}px.`);
  assert(result.clipped.length === 0, `[${viewport.name}/${target.name}] Clipped controls: ${JSON.stringify(result.clipped)}`);
  assert(result.unlabeledControls.length === 0, `[${viewport.name}/${target.name}] Unlabeled controls: ${JSON.stringify(result.unlabeledControls)}`);

  const screenshot = `${target.name}-${viewport.name}.png`;
  await page.screenshot({ path: path.join(outputDir, screenshot), fullPage: true });
  return { type: "standalone", viewport: viewport.name, page: target.name, screenshot, ...result };
}

async function main() {
  await requireHealthyApp();
  await ensureAutofillSnapshotForSmoke();
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(error.message);
  });

  try {
    const captures = [];

    for (const viewport of viewports) {
      for (const section of sections) {
        captures.push(await captureDashboardSection(page, viewport, section));
      }

      for (const atsPage of atsPages) {
        captures.push(await captureAtsPage(page, viewport, atsPage));
      }

      for (const standalonePage of standalonePages) {
        captures.push(await captureStandalonePage(page, viewport, standalonePage));
      }
    }

    assert(consoleErrors.length === 0, `Console errors detected: ${JSON.stringify(consoleErrors.slice(0, 8))}`);

    const result = {
      ok: true,
      baseUrl,
      captureCount: captures.length,
      outputDir,
      captures,
      consoleErrors
    };

    await fs.writeFile(path.join(outputDir, "web-visual-smoke.json"), JSON.stringify(result, null, 2), "utf8");
    console.log(JSON.stringify(result));
  } finally {
    await cleanupSmokeData().catch((error) => {
      console.warn(`[visual-smoke] smoke cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    });
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
