import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(extensionRoot, "..", "..");
const outputDir = path.join(workspaceRoot, "output", "playwright");
const appBase = process.env.CAREERPILOT_WEB_URL || "http://localhost:3000";
const channel = process.env.CAREERPILOT_BROWSER_CHANNEL || "msedge";

const scenarioConfigs = {
  greenhouse: {
    expectedVendor: "Greenhouse",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  },
  workday: {
    expectedVendor: "Workday",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  },
  lever: {
    expectedVendor: "Lever",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  },
  smartrecruiters: {
    expectedVendor: "SmartRecruiters",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  },
  ashby: {
    expectedVendor: "Ashby",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  },
  bamboohr: {
    expectedVendor: "BambooHR",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  },
  company: {
    expectedVendor: "通用表单",
    minFields: 18,
    minDetected: 16,
    minSafe: 10
  }
};

const defaultScenarioTypes = ["greenhouse", "workday", "lever", "smartrecruiters", "ashby", "bamboohr", "company"];

function selectedScenarioTypes() {
  const raw = process.env.CAREERPILOT_ATS_TYPES || process.env.CAREERPILOT_ATS_TYPE;
  if (!raw) return defaultScenarioTypes;

  const types = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const unknown = types.filter((type) => !scenarioConfigs[type]);
  if (unknown.length > 0) {
    throw new Error(`Unknown ATS smoke scenario: ${unknown.join(", ")}`);
  }

  return types.length > 0 ? types : defaultScenarioTypes;
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  return payload;
}

async function requireHealthyApp() {
  const health = await fetchJson(`${appBase}/api/health/text-encoding`);
  if (!health.ok) {
    throw new Error("CareerPilot web health check failed.");
  }
}

async function prepareJobApplication() {
  const jobs = await fetchJson(`${appBase}/api/jobs`);
  const job = jobs.jobs?.[0];
  if (!job) {
    throw new Error("No job is available for extension smoke.");
  }

  await fetchJson(`${appBase}/api/jobs/${job.id}/package/application`, {
    method: "POST",
    body: JSON.stringify({ status: "PREPARED" })
  });
  const pkg = await fetchJson(`${appBase}/api/jobs/${job.id}/package`);
  const applicationId = pkg.package?.application?.id;
  if (!applicationId) {
    throw new Error("Package application was not created.");
  }

  return { job, applicationId };
}

async function setApplicationContext(job, applicationId, atsType) {
  await fetchJson(`${appBase}/api/autofill/context`, {
    method: "POST",
    body: JSON.stringify({
      applicationId,
      jobId: job.id,
      urlHint: `${appBase}/ats-lab?type=${atsType}`,
      ttlMinutes: 30
    })
  });
}

async function getExtensionWorker(context) {
  const existing = context.serviceWorkers()[0];
  if (existing) return existing;
  return context.waitForEvent("serviceworker", { timeout: 15000 });
}

async function runExtensionMessage(worker, message) {
  return worker.evaluate(async ({ type, payload }) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) {
      throw new Error("No active tab is available.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["src/content.js"]
    });

    return chrome.tabs.sendMessage(tab.id, { type, ...payload });
  }, message);
}

async function launchWithExtension(userDataDir) {
  try {
    return await chromium.launchPersistentContext(userDataDir, {
      channel,
      headless: false,
      args: [
        `--disable-extensions-except=${extensionRoot}`,
        `--load-extension=${extensionRoot}`
      ]
    });
  } catch (error) {
    if (channel !== "chromium") {
      return chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
          `--disable-extensions-except=${extensionRoot}`,
          `--load-extension=${extensionRoot}`
        ]
      });
    }
    throw error;
  }
}

async function cleanup(snapshotIds = []) {
  await fetchJson(`${appBase}/api/autofill/context`, { method: "DELETE" }).catch(() => null);
  for (const snapshotId of snapshotIds) {
    await fetchJson(`${appBase}/api/autofill/snapshots/${snapshotId}`, { method: "DELETE" }).catch(() => null);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runScenario({ atsType, browserContext, worker, job, applicationId }) {
  const config = scenarioConfigs[atsType];
  await setApplicationContext(job, applicationId, atsType);

  const page = await browserContext.newPage();
  const url = `${appBase}/ats-lab?type=${atsType}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.bringToFront();

  const payload = { applicationId };
  const scan = await runExtensionMessage(worker, { type: "CAREERPILOT_SCAN_ATS", payload });
  assert(scan.atsVendor === config.expectedVendor, `[${atsType}] Expected ${config.expectedVendor}, got ${scan.atsVendor}`);
  assert(scan.fieldCount >= config.minFields, `[${atsType}] Expected at least ${config.minFields} fields, got ${scan.fieldCount}`);
  assert(scan.detected >= config.minDetected, `[${atsType}] Expected at least ${config.minDetected} detected fields, got ${scan.detected}`);
  assert(scan.safe >= config.minSafe, `[${atsType}] Expected at least ${config.minSafe} safe fields, got ${scan.safe}`);
  assert(scan.review >= 1, `[${atsType}] Expected at least one review field.`);
  assert(scan.sensitive >= 2, `[${atsType}] Expected at least two sensitive fields.`);

  const snapshot = await runExtensionMessage(worker, { type: "CAREERPILOT_SAVE_FORM_SNAPSHOT", payload });
  const snapshotId = snapshot.snapshotId;
  assert(snapshotId, `[${atsType}] Snapshot was not persisted.`);

  const filled = await runExtensionMessage(worker, { type: "CAREERPILOT_FILL_SAFE", payload });
  assert(filled.filled >= config.minSafe, `[${atsType}] Expected at least ${config.minSafe} filled fields, got ${filled.filled}`);
  assert(filled.skipped >= 4, `[${atsType}] Expected review/sensitive/file fields to be skipped.`);

  const values = await page.evaluate(() => ({
    firstName: document.querySelector("input[name='first_name']")?.value,
    lastName: document.querySelector("input[name='last_name']")?.value,
    email: document.querySelector("input[name='email']")?.value,
    country: document.querySelector("select[name='country']")?.value,
    salary: document.querySelector("input[name='salary_expectation']")?.value,
    availableStartDate: document.querySelector("input[name='available_start_date']")?.value,
    workAuthorizationChecked: Boolean(document.querySelector("input[name='work_authorization']:checked")),
    visaSponsorshipChecked: Boolean(document.querySelector("input[name='visa_sponsorship']:checked")),
    checklistChecked: Boolean(document.querySelector("input[name='confirm_truth']:checked")),
    hiddenToken: document.querySelector("input[name='csrf_token']")?.value,
    fileValue: document.querySelector("input[name='resume_upload']")?.value,
    snapshotPanel: Boolean(document.getElementById("careerpilot-autofill-panel"))
  }));

  assert(values.firstName, `[${atsType}] First name was not filled.`);
  assert(values.lastName, `[${atsType}] Last name was not filled.`);
  assert(values.email?.includes("@"), `[${atsType}] Email was not filled.`);
  assert(values.country, `[${atsType}] Country select was not filled.`);
  assert(!values.salary, `[${atsType}] Salary review field should not be filled.`);
  assert(!values.availableStartDate, `[${atsType}] Available start date review field should not be filled.`);
  assert(!values.workAuthorizationChecked, `[${atsType}] Sensitive work authorization radio should not be filled.`);
  assert(!values.visaSponsorshipChecked, `[${atsType}] Sensitive visa sponsorship radio should not be filled.`);
  assert(!values.checklistChecked, `[${atsType}] Checkbox should not be auto-checked.`);
  assert(values.hiddenToken === "careerpilot-lab-token", `[${atsType}] Hidden token should remain untouched.`);
  assert(!values.fileValue, `[${atsType}] File upload should remain empty.`);
  assert(values.snapshotPanel, `[${atsType}] Floating summary panel did not render.`);

  const packageAfter = await fetchJson(`${appBase}/api/autofill/context?url=${encodeURIComponent(url)}`);
  assert(packageAfter.context?.applicationId === applicationId, `[${atsType}] Autofill context did not remain active.`);

  await page.close();

  return {
    atsType,
    expectedVendor: config.expectedVendor,
    snapshotId,
    scan: {
      fieldCount: scan.fieldCount,
      detected: scan.detected,
      safe: scan.safe,
      review: scan.review,
      sensitive: scan.sensitive
    },
    filled: {
      filled: filled.filled,
      skipped: filled.skipped
    },
    values
  };
}

async function main() {
  const scenarioTypes = selectedScenarioTypes();
  await requireHealthyApp();
  const { job, applicationId } = await prepareJobApplication();
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "careerpilot-edge-smoke-"));
  await fs.mkdir(outputDir, { recursive: true });

  let browserContext;
  const snapshotIds = [];

  try {
    browserContext = await launchWithExtension(userDataDir);
    const worker = await getExtensionWorker(browserContext);

    await worker.evaluate(async (base) => {
      await chrome.storage.local.set({ careerPilotApiBase: base });
    }, appBase);

    const scenarios = [];
    for (const atsType of scenarioTypes) {
      const scenario = await runScenario({ atsType, browserContext, worker, job, applicationId });
      snapshotIds.push(scenario.snapshotId);
      scenarios.push(scenario);
    }

    const result = {
      ok: true,
      scenarioCount: scenarios.length,
      applicationId,
      scenarios
    };

    await fs.writeFile(path.join(outputDir, "edge-extension-smoke.json"), JSON.stringify(result, null, 2), "utf8");
    console.log(JSON.stringify(result));
  } finally {
    await browserContext?.close().catch(() => null);
    await cleanup(snapshotIds);
    await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => null);
  }
}

main().catch(async (error) => {
  await cleanup([]);
  console.error(error);
  process.exit(1);
});
