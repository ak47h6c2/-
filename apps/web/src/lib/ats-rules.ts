import type { Sensitivity } from "@prisma/client";

type RawField = Record<string, unknown>;

type AtsRule = {
  vendor: string;
  hostPatterns: string[];
  fieldRules: Array<{
    patterns: RegExp[];
    candidateKey: string;
    sensitivity: Sensitivity;
    confidence: number;
  }>;
};

const commonFieldRules: AtsRule["fieldRules"] = [
  { patterns: [/first\s*name|given\s*name|名(?!字)|名字/i], candidateKey: "givenName", sensitivity: "SAFE", confidence: 94 },
  { patterns: [/preferred\s*name|known\s*as|english\s*name|英文名|常用名/i], candidateKey: "preferredName", sensitivity: "SAFE", confidence: 88 },
  { patterns: [/last\s*name|family\s*name|surname|姓/i], candidateKey: "familyName", sensitivity: "SAFE", confidence: 94 },
  { patterns: [/chinese\s*name|name\s*in\s*chinese|中文姓名|中文名/i], candidateKey: "chineseName", sensitivity: "SAFE", confidence: 88 },
  { patterns: [/full\s*name|legal\s*name|姓名/i], candidateKey: "fullName", sensitivity: "SAFE", confidence: 92 },
  { patterns: [/e-?mail|邮箱|电子邮件/i], candidateKey: "email", sensitivity: "SAFE", confidence: 96 },
  { patterns: [/phone|mobile|telephone|手机号|电话/i], candidateKey: "phone", sensitivity: "SAFE", confidence: 92 },
  { patterns: [/wechat|weixin|微信/i], candidateKey: "wechatId", sensitivity: "REVIEW", confidence: 78 },
  { patterns: [/address|street|地址/i], candidateKey: "addressLine1", sensitivity: "SAFE", confidence: 82 },
  { patterns: [/city|城市/i], candidateKey: "city", sensitivity: "SAFE", confidence: 88 },
  { patterns: [/state|province|region|省|州/i], candidateKey: "state", sensitivity: "SAFE", confidence: 80 },
  { patterns: [/country|国家|地区/i], candidateKey: "country", sensitivity: "SAFE", confidence: 88 },
  { patterns: [/postal|zip|postcode|邮编/i], candidateKey: "postalCode", sensitivity: "SAFE", confidence: 86 },
  { patterns: [/linkedin|linked\s*in/i], candidateKey: "linkedInUrl", sensitivity: "SAFE", confidence: 94 },
  { patterns: [/github/i], candidateKey: "githubUrl", sensitivity: "SAFE", confidence: 94 },
  { patterns: [/portfolio|website|个人网站|作品集/i], candidateKey: "portfolioUrl", sensitivity: "SAFE", confidence: 88 },
  { patterns: [/school|university|college|学校|大学/i], candidateKey: "school", sensitivity: "SAFE", confidence: 88 },
  { patterns: [/degree|学历|学位/i], candidateKey: "degree", sensitivity: "SAFE", confidence: 86 },
  { patterns: [/major|discipline|field\s*of\s*study|专业/i], candidateKey: "major", sensitivity: "SAFE", confidence: 86 },
  { patterns: [/graduation.*month|毕业月份/i], candidateKey: "graduationMonth", sensitivity: "SAFE", confidence: 86 },
  { patterns: [/graduation.*year|毕业年份|毕业时间/i], candidateKey: "graduationYear", sensitivity: "SAFE", confidence: 86 },
  { patterns: [/work\s*authorization|right\s*to\s*work|工作权利|工作许可/i], candidateKey: "workAuthorization", sensitivity: "SENSITIVE", confidence: 90 },
  { patterns: [/sponsor|sponsorship|visa|签证|工签/i], candidateKey: "visaSponsorship", sensitivity: "SENSITIVE", confidence: 90 },
  { patterns: [/nationality|citizenship|citizen|国籍|公民身份/i], candidateKey: "nationality", sensitivity: "SENSITIVE", confidence: 88 },
  { patterns: [/date\s*of\s*birth|birth\s*date|birthday|dob|出生日期|生日/i], candidateKey: "dateOfBirth", sensitivity: "SENSITIVE", confidence: 88 },
  { patterns: [/passport|identity\s*number|national\s*id|id\s*number|身份证|护照|证件号码/i], candidateKey: "identityNumber", sensitivity: "SENSITIVE", confidence: 88 },
  { patterns: [/salary|compensation|薪资|期望薪资/i], candidateKey: "salaryExpectation", sensitivity: "REVIEW", confidence: 78 },
  { patterns: [/notice\s*period|入职时间|到岗/i], candidateKey: "noticePeriod", sensitivity: "REVIEW", confidence: 78 },
  { patterns: [/available\s*start|start\s*date|earliest\s*start|available\s*from|可入职日期|最早到岗/i], candidateKey: "availableStartDate", sensitivity: "REVIEW", confidence: 78 },
  { patterns: [/relocat|搬迁|异地/i], candidateKey: "relocation", sensitivity: "REVIEW", confidence: 78 },
  { patterns: [/years\s*of\s*experience|work\s*experience|experience\s*years|工作年限|项目经验|经验年限/i], candidateKey: "workExperienceYears", sensitivity: "REVIEW", confidence: 74 },
  { patterns: [/desired\s*role|target\s*role|preferred\s*position|期望岗位|目标岗位|意向岗位/i], candidateKey: "targetRole", sensitivity: "REVIEW", confidence: 72 },
  { patterns: [/preferred\s*location|target\s*location|desired\s*location|期望城市|目标地点|意向城市/i], candidateKey: "targetLocation", sensitivity: "REVIEW", confidence: 72 },
  { patterns: [/how.*hear|application\s*source|referral\s*source|获知渠道|招聘渠道|信息来源/i], candidateKey: "sourceChannel", sensitivity: "REVIEW", confidence: 76 },
  { patterns: [/referral|referrer|employee\s*referred|推荐人|内推人/i], candidateKey: "referralName", sensitivity: "REVIEW", confidence: 76 }
];

export const atsRules: AtsRule[] = [
  {
    vendor: "Workday",
    hostPatterns: ["myworkdayjobs.com", "workday.com"],
    fieldRules: [
      { patterns: [/source|how.*hear|渠道/i], candidateKey: "sourceChannel", sensitivity: "REVIEW", confidence: 72 },
      { patterns: [/referral|referrer|推荐人|内推人/i], candidateKey: "referralName", sensitivity: "REVIEW", confidence: 72 },
      ...commonFieldRules
    ]
  },
  {
    vendor: "Greenhouse",
    hostPatterns: ["greenhouse.io", "boards.greenhouse.io"],
    fieldRules: commonFieldRules
  },
  {
    vendor: "Lever",
    hostPatterns: ["lever.co", "jobs.lever.co"],
    fieldRules: commonFieldRules
  },
  {
    vendor: "SmartRecruiters",
    hostPatterns: ["smartrecruiters.com", "jobs.smartrecruiters.com"],
    fieldRules: commonFieldRules
  },
  {
    vendor: "Ashby",
    hostPatterns: ["ashbyhq.com", "jobs.ashbyhq.com"],
    fieldRules: commonFieldRules
  },
  {
    vendor: "BambooHR",
    hostPatterns: ["bamboohr.com", "jobs.bamboohr.com"],
    fieldRules: [
      { patterns: [/candidate.*first|applicant.*first/i], candidateKey: "givenName", sensitivity: "SAFE", confidence: 90 },
      { patterns: [/candidate.*last|applicant.*last/i], candidateKey: "familyName", sensitivity: "SAFE", confidence: 90 },
      { patterns: [/candidate.*email|applicant.*email/i], candidateKey: "email", sensitivity: "SAFE", confidence: 92 },
      { patterns: [/candidate.*phone|applicant.*phone/i], candidateKey: "phone", sensitivity: "SAFE", confidence: 88 },
      ...commonFieldRules
    ]
  }
];

export function detectAtsVendor(url?: string | null, host?: string | null, title?: string | null) {
  const haystack = [url, host, title].filter(Boolean).join(" ").toLowerCase();
  return atsRules.find((rule) => rule.hostPatterns.some((pattern) => haystack.includes(pattern)))?.vendor ?? null;
}

function fieldHaystack(field: RawField) {
  return [
    field.labelText,
    field.label,
    field.placeholder,
    field.inputName,
    field.inputId,
    field.selector,
    field.fieldFingerprint
  ]
    .filter(Boolean)
    .map(String)
    .join(" ");
}

export function applyAtsRulesToField(field: RawField, atsVendor?: string | null) {
  const ruleSet = atsRules.find((rule) => rule.vendor === atsVendor);
  const text = fieldHaystack(field);
  const matchedRule = ruleSet?.fieldRules.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));

  if (!matchedRule) {
    return field;
  }

  const existingConfidence = Number(field.confidence ?? 0);
  const existingSensitivity = String(field.sensitivity ?? "");

  return {
    ...field,
    key: field.key || matchedRule.candidateKey,
    mappedKey: field.mappedKey || field.key || matchedRule.candidateKey,
    sensitivity: existingSensitivity && existingSensitivity !== "unknown" ? existingSensitivity : matchedRule.sensitivity.toLowerCase(),
    confidence: Math.max(existingConfidence, matchedRule.confidence),
    atsRuleMatched: matchedRule.candidateKey
  };
}

export function applyAtsRulesToFields(fields: RawField[], atsVendor?: string | null) {
  return fields.map((field) => applyAtsRulesToField(field, atsVendor));
}

export function serializeAtsRules() {
  return atsRules.map((rule) => ({
    vendor: rule.vendor,
    hostPatterns: rule.hostPatterns,
    fieldRules: rule.fieldRules.map((fieldRule) => ({
      patterns: fieldRule.patterns.map((pattern) => pattern.source),
      flags: fieldRule.patterns.map((pattern) => pattern.flags),
      candidateKey: fieldRule.candidateKey,
      sensitivity: fieldRule.sensitivity.toLowerCase(),
      confidence: fieldRule.confidence
    }))
  }));
}
