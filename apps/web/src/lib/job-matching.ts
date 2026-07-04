import type { MarketCode } from "@prisma/client";

type ScoreInput = {
  market: MarketCode;
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  sourceUrl?: string | null;
};

type ScoreResult = {
  matchScore: number;
  visaRisk: string;
  graduateFit: string;
  reasons: string[];
  positiveReasons: string[];
  negativeReasons: string[];
  riskSignals: string[];
  keywords: string[];
};

const roleKeywords = [
  "software",
  "developer",
  "engineer",
  "backend",
  "frontend",
  "full stack",
  "data",
  "analyst",
  "business analyst",
  "java",
  "node",
  "react",
  "sql",
  "python",
  "后端",
  "前端",
  "软件",
  "开发",
  "数据",
  "分析",
  "产品",
  "商业分析"
];

const graduateSignals = ["graduate", "new grad", "campus", "intern", "internship", "entry level", "校招", "应届", "实习", "管培"];
const negativeSignals = ["senior", "staff", "principal", "lead", "manager", "5+ years", "7+ years", "资深", "专家", "负责人"];
const visaRiskSignals = ["citizen", "permanent resident", "pr only", "no sponsorship", "security clearance", "公民", "永居", "不提供签证"];
const highSignalMarkets: MarketCode[] = ["CN", "SG"];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreJob(input: ScoreInput): ScoreResult {
  const text = [input.title, input.company, input.location, input.description, input.sourceUrl]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const reasons: string[] = [];
  const positiveReasons: string[] = [];
  const negativeReasons: string[] = [];
  const riskSignals: string[] = [];
  const keywords = roleKeywords.filter((keyword) => text.includes(keyword.toLowerCase())).slice(0, 10);
  let score = 50;

  if (includesAny(text, roleKeywords)) {
    score += 18;
    positiveReasons.push("岗位方向与 IT/数据/BA 目标匹配");
  }

  if (includesAny(text, graduateSignals)) {
    score += 16;
    positiveReasons.push("包含校招、实习或毕业生信号");
  }

  if (highSignalMarkets.includes(input.market)) {
    score += 10;
    positiveReasons.push(`${input.market === "CN" ? "中国大陆" : "新加坡"}当前优先级较高`);
  }

  if (input.market === "HK") {
    score += 4;
    positiveReasons.push("香港可作为金融科技补充路线");
  }

  if (input.market === "AU") {
    score -= 4;
    negativeReasons.push("澳洲岗位保留高质量少量投递");
  }

  if (includesAny(text, negativeSignals)) {
    score -= 22;
    negativeReasons.push("岗位资历要求偏高");
  }

  if (includesAny(text, visaRiskSignals)) {
    score -= 18;
    negativeReasons.push("存在工作权利或签证风险信号");
    riskSignals.push(...visaRiskSignals.filter((keyword) => text.includes(keyword.toLowerCase())).slice(0, 5));
  }

  const matchScore = clamp(score);
  const hasVisaRisk = includesAny(text, visaRiskSignals);
  const hasGraduateSignal = includesAny(text, graduateSignals);
  reasons.push(...positiveReasons, ...negativeReasons);

  return {
    matchScore,
    visaRisk: hasVisaRisk || input.market === "AU" ? "高" : input.market === "SG" || input.market === "HK" ? "中" : "低",
    graduateFit: hasGraduateSignal ? "高" : matchScore >= 75 ? "中" : "待判断",
    reasons: reasons.length > 0 ? reasons : ["基础信息不足，按默认规则估算"],
    positiveReasons,
    negativeReasons,
    riskSignals,
    keywords
  };
}

export function buildTaskPackage(input: ScoreInput & ScoreResult) {
  const checklist = [
    "打开岗位链接核对申请截止时间",
    "确认工作权利、签证和地点要求",
    "选择对应市场的简历版本",
    "准备 1 条项目经历和 1 条行为面 STAR 故事",
    "填写安全字段后人工检查再提交"
  ];

  return {
    checklistJson: JSON.stringify(checklist),
    screenerAnswersJson: JSON.stringify({
      market: input.market,
      visaRisk: input.visaRisk,
      graduateFit: input.graduateFit,
      reminders: input.reasons
    }),
    coverLetterDraft: `针对 ${input.company || "目标公司"} 的 ${input.title}，建议突出 IT 项目、数据库/API 能力，以及跨市场求职的适应能力。`
  };
}

export function parseDeadline(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const dateMatch =
    normalized.match(/(?:deadline|close|closing|截止|截至|申请截止)[:：]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i) ??
    normalized.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/);

  if (!dateMatch) return null;

  const date = new Date(dateMatch[1].replaceAll(".", "-").replaceAll("/", "-"));
  return Number.isNaN(date.getTime()) ? null : date;
}
