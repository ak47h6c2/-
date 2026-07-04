const statusText = document.getElementById("statusText");
const detectedCount = document.getElementById("detectedCount");
const safeCount = document.getElementById("safeCount");
const reviewCount = document.getElementById("reviewCount");
const scanButton = document.getElementById("scanButton");
const snapshotButton = document.getElementById("snapshotButton");
const fillButton = document.getElementById("fillButton");
const openPackageButton = document.getElementById("openPackageButton");
const openAppButton = document.getElementById("openAppButton");
const contextCard = document.getElementById("contextCard");
const contextTitle = document.getElementById("contextTitle");
const contextMeta = document.getElementById("contextMeta");
const refreshContextButton = document.getElementById("refreshContextButton");

let activeContext = null;

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/content.js"]
  });
}

async function getApiBase() {
  const { careerPilotApiBase } = await chrome.storage.local.get("careerPilotApiBase");
  return careerPilotApiBase || "http://localhost:3000";
}

function formatExpiry(value) {
  if (!value) return "未设置过期时间";

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "有效期读取失败";
  }
}

function renderContext(payload) {
  const context = payload?.context ?? null;
  activeContext = context;

  if (!context) {
    contextCard.className = "context-card";
    contextTitle.textContent = "未设置当前投递包";
    contextMeta.textContent = "在 Web 投递包里点击“设为当前 Edge 申请”，快照会自动归档。";
    refreshContextButton.textContent = "未绑定";
    openPackageButton.disabled = true;
    return;
  }

  const job = context.application?.job;
  const matchMode = payload.matchMode === "host" ? "当前页面域名匹配" : "当前申请有效";
  const hostText = context.hostHint ? `域名 ${context.hostHint}` : "不限域名";

  contextCard.className = "context-card active";
  contextTitle.textContent = job ? `${job.company} · ${job.title}` : "已绑定申请记录";
  contextMeta.textContent = `${matchMode} · ${hostText} · 有效至 ${formatExpiry(context.expiresAt)}`;
  refreshContextButton.textContent = payload.matchMode === "host" ? "域名匹配" : "已绑定";
  openPackageButton.disabled = false;
}

async function loadCurrentContext(tab) {
  const base = await getApiBase();
  const params = new URLSearchParams();
  if (tab?.url) params.set("url", tab.url);
  const response = await fetch(`${base}/api/autofill/context?${params.toString()}`);

  if (!response.ok) {
    throw new Error("无法读取本地投递包绑定。");
  }

  return response.json();
}

async function refreshContext(options = {}) {
  const { quiet = false } = options;

  if (!quiet) {
    contextCard.className = "context-card";
    contextTitle.textContent = "正在读取绑定...";
    contextMeta.textContent = "正在检查当前页面是否匹配本地投递包。";
    refreshContextButton.textContent = "检查中";
  }

  try {
    const tab = await getActiveTab();
    const payload = await loadCurrentContext(tab);
    renderContext(payload);
    return payload;
  } catch (error) {
    activeContext = null;
    contextCard.className = "context-card warning";
    contextTitle.textContent = "无法连接本地工作台";
    contextMeta.textContent = "确认 Web 应用正在 http://localhost:3000 运行后再刷新。";
    refreshContextButton.textContent = "重试";
    openPackageButton.disabled = true;

    if (!quiet) {
      statusText.textContent = error instanceof Error ? error.message : "读取投递包绑定失败。";
    }

    return { context: null, matchMode: "none" };
  }
}

async function sendToActiveTab(type) {
  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("没有找到当前标签页。");
  }

  const contextPayload = await refreshContext({ quiet: true });
  const applicationId = contextPayload.context?.applicationId || activeContext?.applicationId || null;

  await ensureContentScript(tab.id);
  return chrome.tabs.sendMessage(tab.id, applicationId ? { type, applicationId } : { type });
}

function renderResult(result) {
  if (!result) return;

  detectedCount.textContent = String(result.detected ?? result.fieldCount ?? 0);
  safeCount.textContent = String(result.safe ?? 0);
  reviewCount.textContent = String((result.review ?? 0) + (result.sensitive ?? 0));
  statusText.textContent = result.message ?? "扫描完成。";
}

scanButton.addEventListener("click", async () => {
  try {
    statusText.textContent = "正在扫描当前页面...";
    renderResult(await sendToActiveTab("CAREERPILOT_SCAN_ATS"));
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "扫描失败。";
  }
});

snapshotButton.addEventListener("click", async () => {
  try {
    statusText.textContent = "正在保存表单快照...";
    renderResult(await sendToActiveTab("CAREERPILOT_SAVE_FORM_SNAPSHOT"));
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "保存快照失败。";
  }
});

fillButton.addEventListener("click", async () => {
  try {
    statusText.textContent = "正在填写安全字段...";
    renderResult(await sendToActiveTab("CAREERPILOT_FILL_SAFE"));
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "自动填表失败。";
  }
});

openAppButton.addEventListener("click", async () => {
  chrome.tabs.create({ url: await getApiBase() });
});

openPackageButton.addEventListener("click", async () => {
  const jobId = activeContext?.jobId || activeContext?.application?.job?.id;
  const base = await getApiBase();

  if (!jobId) {
    statusText.textContent = "当前没有可打开的投递包，请先在 Web 里设置当前 Edge 申请。";
    return;
  }

  chrome.tabs.create({ url: `${base}/?section=package&jobId=${encodeURIComponent(jobId)}` });
});

refreshContextButton.addEventListener("click", () => {
  refreshContext();
});

refreshContext();
