(() => {
  if (window.__careerPilotAutofillLoaded) {
    return;
  }

  window.__careerPilotAutofillLoaded = true;

  const fallbackProfile = {
    givenName: "Your",
    familyName: "Name",
    preferredName: "Your",
    chineseName: "你的中文名",
    fullName: "Your Name",
    email: "your.email@example.com",
    phone: "+61 400 000 000",
    wechatId: "",
    addressLine1: "Sydney NSW",
    city: "Sydney",
    state: "NSW",
    country: "Australia",
    postalCode: "",
    linkedInUrl: "https://www.linkedin.com/in/your-profile",
    githubUrl: "https://github.com/your-handle",
    portfolioUrl: "https://your-portfolio.dev",
    school: "UNSW",
    degree: "Master of Information Technology",
    major: "Software Engineering",
    graduationMonth: "November",
    graduationYear: "2027",
    salaryExpectation: "",
    noticePeriod: "可协商",
    availableStartDate: "",
    relocation: "按岗位和市场确认",
    workExperienceYears: "",
    targetRole: "Software / Data / BA",
    targetLocation: "中国大陆 / 新加坡 / 香港 / 澳洲",
    sourceChannel: "公司官网/招聘平台/邮件提醒",
    referralName: ""
  };

  const rules = [
    { key: "givenName", sensitivity: "safe", patterns: ["first name", "given name", "preferred first name", "名", "名字"] },
    { key: "preferredName", sensitivity: "safe", patterns: ["preferred name", "preferred english name", "known as", "english name", "英文名", "常用名"] },
    { key: "familyName", sensitivity: "safe", patterns: ["last name", "family name", "surname", "姓", "姓氏"] },
    { key: "chineseName", sensitivity: "safe", patterns: ["chinese name", "name in chinese", "中文姓名", "中文名"] },
    { key: "fullName", sensitivity: "safe", patterns: ["full name", "legal name", "姓名", "中文名", "英文名"] },
    { key: "email", sensitivity: "safe", patterns: ["email", "e-mail", "邮箱", "电子邮件", "邮件地址"] },
    { key: "phone", sensitivity: "safe", patterns: ["phone", "mobile", "telephone", "手机", "电话", "联系电话"] },
    { key: "wechatId", sensitivity: "review", patterns: ["wechat", "weixin", "微信", "微信号"] },
    { key: "addressLine1", sensitivity: "safe", patterns: ["address line 1", "street address", "address", "住址", "地址", "通讯地址"] },
    { key: "city", sensitivity: "safe", patterns: ["city", "suburb", "城市", "所在城市", "现居地"] },
    { key: "state", sensitivity: "safe", patterns: ["state", "province", "territory", "州", "省", "省份"] },
    { key: "country", sensitivity: "safe", patterns: ["country", "region", "国家", "地区", "国家/地区"] },
    { key: "postalCode", sensitivity: "safe", patterns: ["postal code", "postcode", "zip", "邮编", "邮政编码"] },
    { key: "linkedInUrl", sensitivity: "safe", patterns: ["linkedin", "linked in", "领英"] },
    { key: "githubUrl", sensitivity: "safe", patterns: ["github", "git hub"] },
    { key: "portfolioUrl", sensitivity: "safe", patterns: ["portfolio", "personal website", "website", "个人网站", "作品集"] },
    { key: "school", sensitivity: "safe", patterns: ["school", "university", "institution", "学校", "院校", "大学"] },
    { key: "degree", sensitivity: "safe", patterns: ["degree", "qualification", "学历", "学位"] },
    { key: "major", sensitivity: "safe", patterns: ["major", "field of study", "discipline", "专业", "研究方向"] },
    { key: "graduationMonth", sensitivity: "safe", patterns: ["graduation month", "completion month", "毕业月份"] },
    { key: "graduationYear", sensitivity: "safe", patterns: ["graduation year", "completion year", "毕业年份", "毕业时间"] },
    { key: "salaryExpectation", sensitivity: "review", patterns: ["salary", "expected compensation", "expected pay", "期望薪资", "薪资要求"] },
    { key: "noticePeriod", sensitivity: "review", patterns: ["notice period", "availability", "入职时间", "到岗"] },
    { key: "availableStartDate", sensitivity: "review", patterns: ["available start date", "start date", "earliest start", "available from", "可入职日期", "最早到岗"] },
    { key: "relocation", sensitivity: "review", patterns: ["relocate", "relocation", "willing to move", "是否接受调剂", "是否接受异地"] },
    { key: "workExperienceYears", sensitivity: "review", patterns: ["years of experience", "work experience", "experience years", "工作年限", "项目经验", "经验年限"] },
    { key: "targetRole", sensitivity: "review", patterns: ["desired role", "target role", "preferred position", "期望岗位", "目标岗位", "意向岗位"] },
    { key: "targetLocation", sensitivity: "review", patterns: ["preferred location", "target location", "desired location", "期望城市", "目标地点", "意向城市"] },
    { key: "sourceChannel", sensitivity: "review", patterns: ["how did you hear", "source", "application source", "referral source", "获知渠道", "招聘渠道", "信息来源"] },
    { key: "referralName", sensitivity: "review", patterns: ["referral", "referrer", "employee referred", "推荐人", "内推人"] },
    { key: "nationality", sensitivity: "sensitive", patterns: ["nationality", "citizenship", "citizen", "国籍", "公民身份"] },
    { key: "dateOfBirth", sensitivity: "sensitive", patterns: ["date of birth", "birth date", "birthday", "dob", "出生日期", "生日"] },
    { key: "identityNumber", sensitivity: "sensitive", patterns: ["passport", "identity number", "national id", "id number", "身份证", "护照", "证件号码"] },
    { key: "workAuthorization", sensitivity: "sensitive", patterns: ["authorized to work", "right to work", "work rights", "工作权利", "工作许可"] },
    { key: "visaSponsorship", sensitivity: "sensitive", patterns: ["sponsorship", "visa sponsor", "require visa", "签证担保", "工签"] }
  ];

  const fallbackAtsRules = [
    { vendor: "Workday", hostPatterns: ["myworkdayjobs.com", "workday.com"], containerSelectors: ["[data-automation-id]", "form", "main"] },
    { vendor: "Greenhouse", hostPatterns: ["greenhouse.io", "boards.greenhouse.io"], containerSelectors: [".application--container", "#application_form", "form"] },
    { vendor: "Lever", hostPatterns: ["lever.co", "jobs.lever.co"], containerSelectors: [".application-form", ".posting", "form"] },
    { vendor: "SmartRecruiters", hostPatterns: ["smartrecruiters.com"], containerSelectors: ["[data-test]", ".job-application", "form"] },
    { vendor: "Ashby", hostPatterns: ["ashbyhq.com", "jobs.ashbyhq.com"], containerSelectors: ["[data-testid]", ".ashby-job-posting", "form"] },
    { vendor: "BambooHR", hostPatterns: ["bamboohr.com", "jobs.bamboohr.com"], containerSelectors: ["[data-bi-id]", ".bamboohr-application", ".BambooHR-ATS-board", "form"] }
  ];

  const containerSelectorsByVendor = {
    Workday: ["[data-automation-id]", "form", "main"],
    Greenhouse: [".application--container", "#application_form", "form"],
    Lever: [".application-form", ".posting", "form"],
    SmartRecruiters: ["[data-test]", ".job-application", "form"],
    Ashby: ["[data-testid]", ".ashby-job-posting", "form"],
    BambooHR: ["[data-bi-id]", ".bamboohr-application", ".BambooHR-ATS-board", "form"],
    通用表单: ["form", "main", "body"]
  };

  let remoteAtsRulesCache = null;
  let remoteAtsRulesLoadedAt = 0;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function simpleHash(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(index);
      hash |= 0;
    }
    return `f_${Math.abs(hash).toString(36)}`;
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function cssPath(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
      const id = node.getAttribute("id");
      if (id) {
        parts.unshift(`#${CSS.escape(id)}`);
        break;
      }
      const name = node.nodeName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) {
        parts.unshift(name);
        break;
      }
      const siblings = Array.from(parent.children).filter((item) => item.nodeName === node.nodeName);
      const index = siblings.indexOf(node) + 1;
      parts.unshift(siblings.length > 1 ? `${name}:nth-of-type(${index})` : name);
      node = parent;
    }
    return parts.join(" > ");
  }

  function nearestText(element) {
    const snippets = [];
    const fieldset = element.closest("fieldset");
    const legend = fieldset?.querySelector("legend");
    if (legend) snippets.push(legend.innerText);

    let sibling = element.previousElementSibling;
    let hops = 0;
    while (sibling && hops < 2) {
      snippets.push(sibling.innerText || sibling.textContent || "");
      sibling = sibling.previousElementSibling;
      hops += 1;
    }

    const wrapper = element.closest("[data-automation-id], [data-test], [data-testid], [data-qa], .field, .form-field, .application-question, label, div, li, section");
    if (wrapper) snippets.push(wrapper.innerText?.slice(0, 280));

    return snippets.filter(Boolean).join(" ");
  }

  function textFromLabels(element) {
    const labels = [];

    if (element.labels) {
      for (const label of element.labels) {
        labels.push(label.innerText);
      }
    }

    const ariaLabel = element.getAttribute("aria-label");
    const labelledBy = element.getAttribute("aria-labelledby");

    if (ariaLabel) labels.push(ariaLabel);
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const node = document.getElementById(id);
        if (node) labels.push(node.innerText);
      }
    }

    const placeholder = element.getAttribute("placeholder");
    const name = element.getAttribute("name");
    const id = element.getAttribute("id");
    const describedBy = element.getAttribute("aria-describedby");
    if (placeholder) labels.push(placeholder);
    if (name) labels.push(name);
    if (id) labels.push(id);
    if (describedBy) {
      for (const idRef of describedBy.split(/\s+/)) {
        const node = document.getElementById(idRef);
        if (node) labels.push(node.innerText);
      }
    }

    for (const attr of ["autocomplete", "data-automation-id", "data-qa", "data-test", "data-testid"]) {
      const value = element.getAttribute(attr);
      if (value) labels.push(value);
    }

    labels.push(nearestText(element));

    return labels.filter(Boolean).join(" ");
  }

  function detectStaticRule(text) {
    const normalized = normalize(text);
    return rules.find((rule) => rule.patterns.some((pattern) => normalized.includes(pattern.toLowerCase()))) || null;
  }

  function compileRemoteRule(rule) {
    return {
      ...rule,
      fieldRules: (rule.fieldRules || []).map((fieldRule) => ({
        ...fieldRule,
        patterns: (fieldRule.patterns || []).map((pattern, index) => {
          try {
            return new RegExp(pattern, fieldRule.flags?.[index] || "i");
          } catch {
            return null;
          }
        }).filter(Boolean)
      }))
    };
  }

  async function loadAtsRules() {
    const now = Date.now();
    if (remoteAtsRulesCache && now - remoteAtsRulesLoadedAt < 5 * 60 * 1000) {
      return remoteAtsRulesCache;
    }

    try {
      const base = await getApiBase();
      const response = await fetch(`${base}/api/autofill/ats-rules`);
      if (!response.ok) throw new Error("ATS rules unavailable");
      const data = await response.json();
      remoteAtsRulesCache = Array.isArray(data.vendors) ? data.vendors.map(compileRemoteRule) : [];
      remoteAtsRulesLoadedAt = now;
      return remoteAtsRulesCache;
    } catch {
      remoteAtsRulesCache = fallbackAtsRules;
      remoteAtsRulesLoadedAt = now;
      return remoteAtsRulesCache;
    }
  }

  function detectAts(atsRuleSets = fallbackAtsRules) {
    const marker = document.querySelector("[data-careerpilot-ats]");
    const markedVendor = marker?.getAttribute("data-careerpilot-ats");
    if (markedVendor) {
      return {
        vendor: markedVendor,
        hostPatterns: [],
        containerSelectors: containerSelectorsByVendor[markedVendor] || ["[data-careerpilot-ats]", "form", "main"]
      };
    }

    const host = location.hostname.toLowerCase();
    return (
      atsRuleSets.find((rule) => rule.hostPatterns?.some((pattern) => host.includes(pattern))) || {
        vendor: "通用表单",
        hostPatterns: [],
        containerSelectors: ["form", "main", "body"]
      }
    );
  }

  function inputOptions(node) {
    if (node.tagName.toLowerCase() !== "select") return [];
    return Array.from(node.options).map((option) => ({
      label: option.text,
      value: option.value
    }));
  }

  function fingerprintFor(meta, atsVendor) {
    return simpleHash([location.hostname, atsVendor, meta.inputName, meta.inputId, meta.inputType, meta.placeholder, meta.labelText].join("|"));
  }

  function matchMappingRule(field, mappingRules) {
    const normalizedLabel = normalize(field.labelText);
    const normalizedName = normalize(field.inputName);

    return mappingRules.find((rule) => {
      if (rule.fieldFingerprint && rule.fieldFingerprint === field.fieldFingerprint) return true;
      if (rule.inputName && normalizedName && normalize(rule.inputName) === normalizedName) return true;
      const pattern = normalize(rule.labelPattern);
      return pattern && (normalizedLabel.includes(pattern) || pattern.includes(normalizedLabel.slice(0, 80)));
    });
  }

  function matchAtsFieldRule(text, ats, atsRuleSets) {
    const ruleSet = atsRuleSets.find((rule) => rule.vendor === ats.vendor);
    return ruleSet?.fieldRules?.find((fieldRule) => fieldRule.patterns?.some((pattern) => pattern.test(text))) || null;
  }

  function scopedFieldNodes(ats) {
    const selectors = ats.containerSelectors || containerSelectorsByVendor[ats.vendor] || ["form", "main", "body"];
    const roots = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const sourceRoots = roots.length ? roots : [document.body];
    const nodes = sourceRoots.flatMap((root) => Array.from(root.querySelectorAll("input, textarea, select")));
    return Array.from(new Set(nodes));
  }

  function collectFields(mappingRules = [], ats = detectAts(), atsRuleSets = fallbackAtsRules) {
    const nodes = scopedFieldNodes(ats);

    return nodes
      .filter((node) => {
        const type = normalize(node.getAttribute("type"));
        return !node.disabled && !node.readOnly && type !== "hidden" && type !== "password" && isVisible(node);
      })
      .map((node) => {
        const labelText = textFromLabels(node);
        const meta = {
          node,
          labelText,
          label: labelText.slice(0, 220),
          inputName: node.getAttribute("name") || "",
          inputId: node.getAttribute("id") || "",
          inputType: node.getAttribute("type") || node.tagName.toLowerCase(),
          required: Boolean(node.required || node.getAttribute("aria-required") === "true"),
          placeholder: node.getAttribute("placeholder") || "",
          selector: cssPath(node),
          options: inputOptions(node)
        };
        const fieldFingerprint = fingerprintFor(meta, ats.vendor);
        const mapped = matchMappingRule({ ...meta, fieldFingerprint }, mappingRules);
        const atsFieldRule = mapped ? null : matchAtsFieldRule(labelText, ats, atsRuleSets);
        const staticRule = mapped || atsFieldRule ? null : detectStaticRule(labelText);
        const key = mapped?.candidateKey || atsFieldRule?.candidateKey || staticRule?.key || null;
        const sensitivity = mapped?.sensitivity || atsFieldRule?.sensitivity || staticRule?.sensitivity || "unknown";

        return {
          ...meta,
          fieldFingerprint,
          key,
          mappedKey: mapped?.candidateKey || null,
          mappingRuleId: mapped?.id || null,
          sensitivity,
          confidence: mapped?.confidence || atsFieldRule?.confidence || (staticRule ? 82 : 0),
          atsRuleMatched: atsFieldRule?.candidateKey || null
        };
      });
  }

  async function getApiBase() {
    const { careerPilotApiBase } = await chrome.storage.local.get("careerPilotApiBase");
    return careerPilotApiBase || "http://localhost:3000";
  }

  async function loadProfile() {
    try {
      const base = await getApiBase();
      const response = await fetch(`${base}/api/autofill/profile`);

      if (!response.ok) return fallbackProfile;

      const data = await response.json();
      return Object.fromEntries((data.profile || []).map((field) => [field.key, field.value]));
    } catch {
      return fallbackProfile;
    }
  }

  async function loadMappingRules(atsVendor) {
    try {
      const base = await getApiBase();
      const params = new URLSearchParams({ host: location.hostname, atsVendor });
      const response = await fetch(`${base}/api/autofill/mapping-rules?${params.toString()}`);
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data.rules) ? data.rules : [];
    } catch {
      return [];
    }
  }

  async function loadApplicationBinding() {
    try {
      const { careerPilotApplicationId } = await chrome.storage.local.get("careerPilotApplicationId");
      if (careerPilotApplicationId) return careerPilotApplicationId;
    } catch {
      // 继续尝试读取本地上下文。
    }

    try {
      const base = await getApiBase();
      const params = new URLSearchParams({ url: location.href });
      const response = await fetch(`${base}/api/autofill/context?${params.toString()}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.context?.applicationId || null;
    } catch {
      return null;
    }
  }

  async function recordEvent(summary, fields, options = {}) {
    try {
      const base = await getApiBase();
      const applicationId = options.applicationId || (await loadApplicationBinding());
      const response = await fetch(`${base}/api/autofill/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: location.href,
          title: document.title,
          applicationId,
          atsVendor: summary.atsVendor,
          eventType: options.eventType || "scan",
          persistSnapshot: Boolean(options.persistSnapshot),
          fieldsDetected: fields.length,
          fieldsFilled: summary.filled,
          fieldsSkipped: summary.skipped,
          fields: fields.map(({ node: _node, ...field }) => field)
        })
      });
      return response.ok ? response.json() : null;
    } catch {
      // 本地服务未启动时不阻塞填表。
      return null;
    }
  }

  function setNativeValue(element, value) {
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillSelect(select, value) {
    const normalizedValue = normalize(value);
    const option = Array.from(select.options).find((item) => {
      return normalize(item.text).includes(normalizedValue) || normalize(item.value).includes(normalizedValue);
    });

    if (!option) return false;

    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function fillSafeFields(options = {}) {
    const atsRuleSets = await loadAtsRules();
    const ats = detectAts(atsRuleSets);
    const mappingRules = await loadMappingRules(ats.vendor);
    const fields = collectFields(mappingRules, ats, atsRuleSets);
    const profile = await loadProfile();
    let filled = 0;
    let skipped = 0;

    for (const field of fields) {
      if (!field.key || field.sensitivity !== "safe") {
        skipped += 1;
        continue;
      }

      const value = profile[field.key];

      if (!value) {
        skipped += 1;
        continue;
      }

      const tagName = field.node.tagName.toLowerCase();
      const type = normalize(field.node.getAttribute("type"));

      if (tagName === "select") {
        if (fillSelect(field.node, value)) filled += 1;
        else skipped += 1;
        continue;
      }

      if (type === "checkbox" || type === "radio" || type === "file") {
        skipped += 1;
        continue;
      }

      setNativeValue(field.node, value);
      field.node.dataset.careerpilotFilled = "true";
      field.node.style.outline = "2px solid rgba(8, 120, 105, 0.55)";
      field.node.style.outlineOffset = "2px";
      filled += 1;
    }

    const summary = summarize(fields, `已填写 ${filled} 个安全字段。提交前请人工检查页面。`, filled, skipped, ats);
    await recordEvent(summary, fields, { eventType: "fill", applicationId: options.applicationId });
    return summary;
  }

  function summarize(fields, message, filled = 0, skipped = 0, ats = detectAts()) {
    const detected = fields.filter((field) => field.key).length;
    const safe = fields.filter((field) => field.sensitivity === "safe").length;
    const review = fields.filter((field) => field.sensitivity === "review").length;
    const sensitive = fields.filter((field) => field.sensitivity === "sensitive").length;
    const summary = { fieldCount: fields.length, detected, safe, review, sensitive, filled, skipped, message, atsVendor: ats.vendor };

    renderFloatingSummary(summary);
    return summary;
  }

  async function extractFormSchema() {
    const atsRuleSets = await loadAtsRules();
    const ats = detectAts(atsRuleSets);
    const mappingRules = await loadMappingRules(ats.vendor);
    const fields = collectFields(mappingRules, ats, atsRuleSets);
    const schema = {
      url: location.href,
      title: document.title,
      atsVendor: ats.vendor,
      fieldCount: fields.length,
      fields: fields.map(({ node: _node, ...field }) => field)
    };
    const summary = summarize(fields, `已识别 ${ats.vendor}，提取 ${fields.length} 个字段。`, 0, 0, ats);
    return { ...summary, schema, fields: schema.fields };
  }

  function renderFloatingSummary(summary) {
    let panel = document.getElementById("careerpilot-autofill-panel");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "careerpilot-autofill-panel";
      panel.style.cssText = [
        "position:fixed",
        "right:18px",
        "bottom:18px",
        "z-index:2147483647",
        "width:292px",
        "padding:14px",
        "border-radius:12px",
        "background:#fff",
        "border:1px solid #d8dee8",
        "box-shadow:0 18px 50px rgba(16,23,34,.14)",
        "font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        "color:#101722"
      ].join(";");
      document.body.appendChild(panel);
    }

    panel.innerHTML = `
      <div style="font-size:12px;font-weight:800;color:#087869;">CareerPilot 自动填表</div>
      <div style="font-size:11px;margin-top:4px;color:#647083;">${escapeHtml(summary.atsVendor || "通用表单")}</div>
      <div style="font-size:14px;margin-top:6px;line-height:1.45;">${escapeHtml(summary.message)}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;">
        <div style="background:#ddf7f1;padding:8px;border-radius:8px;"><strong>${summary.detected}</strong><br><span style="font-size:11px;color:#647083;">已识别</span></div>
        <div style="background:#ddf7f1;padding:8px;border-radius:8px;"><strong>${summary.safe}</strong><br><span style="font-size:11px;color:#647083;">可填写</span></div>
        <div style="background:#fff1d6;padding:8px;border-radius:8px;"><strong>${summary.review + summary.sensitive}</strong><br><span style="font-size:11px;color:#647083;">待确认</span></div>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "CAREERPILOT_SCAN") {
      extractFormSchema().then((result) => {
        recordEvent(result, result.fields, { applicationId: message.applicationId }).finally(() => sendResponse(result));
      });
      return true;
    }

    if (message.type === "CAREERPILOT_SCAN_ATS" || message.type === "CAREERPILOT_EXTRACT_FORM_SCHEMA") {
      extractFormSchema().then((result) => {
        recordEvent(result, result.fields, { eventType: "scan", applicationId: message.applicationId }).finally(() => sendResponse(result));
      });
      return true;
    }

    if (message.type === "CAREERPILOT_SAVE_FORM_SNAPSHOT") {
      extractFormSchema().then((result) => {
        recordEvent(result, result.fields, { eventType: "snapshot", persistSnapshot: true, applicationId: message.applicationId }).then((saved) =>
          sendResponse({
            ...result,
            snapshotId: saved?.snapshot?.id || null,
            message: saved?.snapshot?.id ? `表单快照已保存到本地工作台：${saved.snapshot.id}` : "表单快照已保存到本地工作台。"
          })
        );
      });
      return true;
    }

    if (message.type === "CAREERPILOT_FILL_SAFE") {
      fillSafeFields({ applicationId: message.applicationId }).then(sendResponse);
      return true;
    }

    return false;
  });
})();
