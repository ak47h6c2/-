"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BadgeCheck,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FileText,
  Globe2,
  Info,
  Layers3,
  LoaderCircle,
  MousePointerClick,
  Plus,
  Radar,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Upload
} from "lucide-react";

type SectionKey = "today" | "package" | "sources" | "materials" | "autofill" | "applications" | "markets" | "interviews" | "backup";
type MarketCode = "AU" | "SG" | "HK" | "CN" | "GLOBAL";
type ProfilePackMarket = MarketCode | "ALL";
type JobQualityKey = "MISSING_LINK" | "SHORT_JD" | "LOW_SCORE" | "HIGH_RISK" | "STALE" | "DUPLICATE";
type JobQualityFilter = JobQualityKey | "ALL";
type SourceTypeCode = "MANUAL" | "ADZUNA" | "ATS" | "EMAIL_ALERT" | "COMPANY_SITE";
type Sensitivity = "safe" | "review" | "sensitive";
type ApplicationStatus = "SAVED" | "PREPARED" | "APPLIED" | "OA" | "INTERVIEW" | "REJECTED" | "OFFER" | "SKIPPED";

type ProfileField = {
  id?: string;
  key: string;
  label: string;
  value: string;
  market?: MarketCode | null;
  sensitivity: Sensitivity;
};

type Profile = {
  id: string;
  name: string;
  headline?: string | null;
  updatedAt: string;
  fields: ProfileField[];
};

type FormSnapshotField = {
  id: string;
  snapshotId: string;
  fieldFingerprint: string;
  label: string;
  inputName?: string | null;
  inputId?: string | null;
  inputType?: string | null;
  placeholder?: string | null;
  required: boolean;
  detectedKey?: string | null;
  mappedKey?: string | null;
  sensitivity: Sensitivity;
  confidence: number;
  selector?: string | null;
  options?: string[];
};

type FormSnapshot = {
  id: string;
  applicationId?: string | null;
  url: string;
  host?: string | null;
  title?: string | null;
  atsVendor?: string | null;
  source: string;
  fieldCount: number;
  safeCount: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  fields: FormSnapshotField[];
};

type FieldMappingRule = {
  id: string;
  formFieldId?: string | null;
  host?: string | null;
  atsVendor?: string | null;
  fieldFingerprint?: string | null;
  labelPattern: string;
  inputName?: string | null;
  candidateKey: string;
  sensitivity: Sensitivity;
  confidence: number;
  enabled: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
};

type AutofillRun = {
  id: string;
  applicationId?: string | null;
  snapshotId?: string | null;
  url: string;
  atsVendor?: string | null;
  mode: string;
  fieldsDetected: number;
  fieldsFilled: number;
  fieldsSkipped: number;
  createdAt: string;
  snapshotTitle?: string | null;
  jobTitle?: string | null;
  company?: string | null;
};

type BackupCountKey =
  | "profiles"
  | "profileFields"
  | "jobSources"
  | "importBatches"
  | "jobs"
  | "parseResults"
  | "applications"
  | "plans"
  | "tasks"
  | "taskPackages"
  | "answers"
  | "resumeAssets"
  | "resumes"
  | "materialDrafts"
  | "formSnapshots"
  | "formFields"
  | "mappingRules"
  | "autofillRuns"
  | "runFieldSnapshots"
  | "corrections"
  | "autofillContexts";

type BackupPreview = {
  ok: boolean;
  product: string | null;
  schemaVersion: number | null;
  exportedAt: string | null;
  mode: "merge";
  counts: Record<BackupCountKey, number>;
  warnings: string[];
  errors: string[];
};

type BackupImportResult = {
  ok: boolean;
  mode: "merge";
  preview: BackupPreview;
  imported: Record<BackupCountKey, number>;
  skipped: Record<BackupCountKey, number>;
};

type TextEncodingHealth = {
  ok: boolean;
  files: Array<{ filePath: string; hits: string[] }>;
  database: Array<{ id: string; title: string; company: string }>;
};

type OpsItem = {
  key: SectionKey;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "info" | "warning" | "neutral";
  icon: LucideIcon;
};

type SetupChecklistItem = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
  target: SectionKey;
  actionLabel: string;
  tone: "success" | "info" | "warning" | "neutral";
  icon: LucideIcon;
};

type GlobalSearchResult = {
  key: string;
  label: string;
  title: string;
  detail: string;
  target: SectionKey;
  jobId?: string;
};

type Job = {
  id: string;
  market: MarketCode;
  title: string;
  company: string;
  location?: string | null;
  sourceUrl?: string | null;
  description: string;
  matchScore?: number | null;
  visaRisk?: string | null;
  graduateFit?: string | null;
  archived: boolean;
  firstSeenAt?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
  applications?: Application[];
};

type JobSourceItem = {
  id: string;
  name: string;
  market: MarketCode;
  sourceType: string;
  baseUrl?: string | null;
  reliability: number;
  enabled: boolean;
  lastSyncedAt?: string | null;
  _count?: { jobs: number; importBatches: number; syncLogs: number };
  syncLogs?: Array<{
    id: string;
    action: string;
    status: string;
    message?: string | null;
    createdAt: string;
  }>;
};

type SourceSyncResult = {
  sourceId: string;
  sourceName: string;
  status: "success" | "partial" | "failed" | "skipped";
  imported: number;
  deduped: number;
  skipped: number;
  errors: number;
  total: number;
  extractedChars: number;
  batchId?: string;
  message: string;
};

type SourceSyncResponse = {
  results: SourceSyncResult[];
  totals: {
    imported: number;
    deduped: number;
    skipped: number;
    errors: number;
    total: number;
  };
  message: string;
};

type ImportBatch = {
  id: string;
  sourceName: string;
  importType: string;
  totalCount: number;
  importedCount: number;
  dedupedCount: number;
  skippedCount: number;
  errorCount: number;
  issuesJson?: string | null;
  createdAt: string;
  jobs?: Job[];
};

type CsvImportResult = {
  imported: number;
  skipped: number;
  deduped: number;
  jobs: Job[];
  batch?: ImportBatch;
};

type ResumeVersion = {
  id: string;
  name: string;
  market?: MarketCode | null;
  roleFamily: string;
  language: string;
  content: string;
  isDefault: boolean;
};

type MaterialDraft = {
  id: string;
  jobId: string;
  resumeVersionId?: string | null;
  draftType: string;
  title: string;
  content: string;
  status: string;
  job: Job;
  resumeVersion?: ResumeVersion | null;
};

type ParsedJob = {
  market: MarketCode;
  company: string;
  title: string;
  location?: string | null;
  matchScore: number;
  visaRisk: string;
  graduateFit: string;
  keywords: string[];
  positiveReasons: string[];
  negativeReasons: string[];
};

type JobParseIssue = {
  rawText: string;
  reason: string;
  sourceUrl?: string | null;
};

type Application = {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  notes?: string | null;
  appliedAt?: string | null;
  responseAt?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  updatedAt: string;
  job: Job;
};

type JobParsePackage = {
  keywords: string[];
  positiveReasons: string[];
  negativeReasons: string[];
  riskSignals: string[];
  deadline?: string | null;
  confidence: number;
} | null;

type JobPackageDetails = {
  job: Job;
  parseResult: JobParsePackage;
  application: Application | null;
  drafts: MaterialDraft[];
  recommendedResume: ResumeVersion | null;
  answers: AnswerItem[];
  boundSnapshots: FormSnapshot[];
  availableSnapshots: FormSnapshot[];
  recentRuns: AutofillRun[];
  mappingRuleCount: number;
  edgeContext?: {
    active: boolean;
    urlHint?: string | null;
    hostHint?: string | null;
    expiresAt?: string | null;
  } | null;
  readiness?: {
    checks: Array<{
      key: string;
      label: string;
      done: boolean;
      detail: string;
    }>;
    doneCount: number;
    totalCount: number;
    percent: number;
  };
};

type AnswerItem = {
  id: string;
  question: string;
  answer: string;
  market?: MarketCode | null;
  roleFamily?: string | null;
  sensitivity: "SAFE" | "REVIEW" | "SENSITIVE";
};

type DailyPlan = {
  id: string;
  targetCount: number;
  status: string;
  tasks: Array<{
    id: string;
    status: string;
    priority: number;
    matchScore?: number | null;
    riskLevel?: string | null;
    job: Job;
    package?: {
      checklistJson?: string | null;
      screenerAnswersJson?: string | null;
      coverLetterDraft?: string | null;
    } | null;
  }>;
};

const navigation: Array<{ key: SectionKey; label: string; icon: LucideIcon }> = [
  { key: "today", label: "今日打卡", icon: Sparkles },
  { key: "package", label: "投递包", icon: BadgeCheck },
  { key: "sources", label: "数据源", icon: Upload },
  { key: "materials", label: "材料库", icon: Layers3 },
  { key: "autofill", label: "填表资料库", icon: ShieldCheck },
  { key: "applications", label: "投递管线", icon: BriefcaseBusiness },
  { key: "markets", label: "市场雷达", icon: Globe2 },
  { key: "interviews", label: "笔试面试库", icon: ClipboardList },
  { key: "backup", label: "本地备份", icon: Archive }
];

const sectionCopy: Record<SectionKey, { title: string; subtitle: string }> = {
  today: {
    title: "今日打卡",
    subtitle: "生成每日短名单，把重复填写、材料准备和跟进动作压缩到一个工作流里。"
  },
  package: {
    title: "投递包",
    subtitle: "把单个岗位的 JD、材料、题库、填表快照和投递状态放到一个工作台处理。"
  },
  sources: {
    title: "数据源",
    subtitle: "把 CSV、剪贴板、邮件提醒和官网岗位统一导入、解析、去重。"
  },
  materials: {
    title: "材料库",
    subtitle: "为每个岗位生成可编辑的简历版本建议、Cover Letter 大纲和筛选题草稿。"
  },
  autofill: {
    title: "填表资料库",
    subtitle: "维护 Edge 扩展读取的本地资料，安全字段可一键填写，敏感字段人工确认。"
  },
  applications: {
    title: "投递管线",
    subtitle: "记录每个岗位的状态、下一步动作和备注，避免投递后信息散落。"
  },
  markets: {
    title: "市场雷达",
    subtitle: "把中国大陆、香港、新加坡、澳洲和远程岗位统一入库、去重和排序。"
  },
  interviews: {
    title: "笔试面试库",
    subtitle: "沉淀 OA、技术面、行为面和签证/工作权利回答，形成可复用答案库。"
  },
  backup: {
    title: "本地备份",
    subtitle: "导出当前 SQLite 本地数据，避免岗位、材料和填表规则丢失。"
  }
};

const marketLabels: Record<MarketCode, string> = {
  AU: "澳洲",
  SG: "新加坡",
  HK: "香港",
  CN: "中国大陆",
  GLOBAL: "远程/全球"
};

const profilePackMarketLabels: Record<ProfilePackMarket, string> = {
  ALL: "全部市场",
  ...marketLabels
};

const statusLabels: Record<ApplicationStatus, string> = {
  SAVED: "已收藏",
  PREPARED: "已准备",
  APPLIED: "已投递",
  OA: "笔试",
  INTERVIEW: "面试",
  REJECTED: "未通过",
  OFFER: "Offer",
  SKIPPED: "跳过"
};

const taskStatusLabels: Record<string, string> = {
  queued: "待处理",
  prepared: "已准备",
  applied: "已投递",
  skipped: "已跳过"
};

const materialStatusLabels: Record<string, string> = {
  draft: "草稿",
  review: "待检查",
  ready: "可提交",
  used: "已使用"
};

const sensitivityLabels: Record<Sensitivity, string> = {
  safe: "安全可填",
  review: "需要确认",
  sensitive: "敏感勿填"
};

const answerSensitivityLabels: Record<AnswerItem["sensitivity"], string> = {
  SAFE: "安全可复用",
  REVIEW: "使用前确认",
  SENSITIVE: "敏感勿外发"
};

const jobQualityLabels: Record<JobQualityKey, string> = {
  MISSING_LINK: "缺链接",
  SHORT_JD: "JD 太短",
  LOW_SCORE: "低匹配",
  HIGH_RISK: "高风险",
  STALE: "长期未见",
  DUPLICATE: "疑似重复"
};

const jobQualityFilterLabels: Record<JobQualityFilter, string> = {
  ALL: "全部质量",
  ...jobQualityLabels
};

const defaultField: ProfileField = {
  key: "customField",
  label: "自定义字段",
  value: "",
  market: null,
  sensitivity: "review"
};

type ProfileTemplateField = Omit<ProfileField, "id">;

const apacProfileTemplates: ProfileTemplateField[] = [
  { key: "givenName", label: "名", value: "", market: null, sensitivity: "safe" },
  { key: "familyName", label: "姓", value: "", market: null, sensitivity: "safe" },
  { key: "preferredName", label: "常用名/英文名", value: "", market: null, sensitivity: "safe" },
  { key: "chineseName", label: "中文姓名", value: "", market: null, sensitivity: "safe" },
  { key: "fullName", label: "姓名", value: "", market: null, sensitivity: "safe" },
  { key: "email", label: "邮箱", value: "", market: null, sensitivity: "safe" },
  { key: "phone", label: "电话", value: "", market: null, sensitivity: "safe" },
  { key: "wechatId", label: "微信", value: "", market: "CN", sensitivity: "review" },
  { key: "addressLine1", label: "地址", value: "", market: null, sensitivity: "safe" },
  { key: "city", label: "城市", value: "", market: null, sensitivity: "safe" },
  { key: "state", label: "州/省", value: "", market: null, sensitivity: "safe" },
  { key: "country", label: "国家/地区", value: "", market: null, sensitivity: "safe" },
  { key: "postalCode", label: "邮编", value: "", market: null, sensitivity: "safe" },
  { key: "linkedInUrl", label: "LinkedIn", value: "", market: null, sensitivity: "safe" },
  { key: "githubUrl", label: "GitHub", value: "", market: null, sensitivity: "safe" },
  { key: "portfolioUrl", label: "作品集", value: "", market: null, sensitivity: "safe" },
  { key: "school", label: "学校", value: "", market: null, sensitivity: "safe" },
  { key: "degree", label: "学位", value: "", market: null, sensitivity: "safe" },
  { key: "major", label: "专业", value: "", market: null, sensitivity: "safe" },
  { key: "graduationMonth", label: "毕业月份", value: "", market: null, sensitivity: "safe" },
  { key: "graduationYear", label: "毕业年份", value: "", market: null, sensitivity: "safe" },
  { key: "salaryExpectation", label: "期望薪资", value: "", market: null, sensitivity: "review" },
  { key: "noticePeriod", label: "到岗时间", value: "", market: null, sensitivity: "review" },
  { key: "availableStartDate", label: "可入职日期", value: "", market: null, sensitivity: "review" },
  { key: "relocation", label: "是否接受异地/调剂", value: "", market: null, sensitivity: "review" },
  { key: "workExperienceYears", label: "工作/项目年限", value: "", market: null, sensitivity: "review" },
  { key: "targetRole", label: "目标岗位", value: "", market: null, sensitivity: "review" },
  { key: "targetLocation", label: "目标地点", value: "", market: null, sensitivity: "review" },
  { key: "sourceChannel", label: "获知渠道", value: "", market: null, sensitivity: "review" },
  { key: "referralName", label: "推荐人", value: "", market: null, sensitivity: "review" },
  { key: "workAuthorization", label: "工作权利回答", value: "", market: null, sensitivity: "review" },
  { key: "visaSponsorship", label: "签证担保回答", value: "", market: null, sensitivity: "review" },
  { key: "nationality", label: "国籍/公民身份", value: "", market: null, sensitivity: "sensitive" },
  { key: "dateOfBirth", label: "出生日期", value: "", market: null, sensitivity: "sensitive" },
  { key: "identityNumber", label: "证件号码", value: "", market: null, sensitivity: "sensitive" }
];

const profileTemplateMap = new Map(apacProfileTemplates.map((field) => [field.key, field]));

const profileCompletionGroups = [
  {
    key: "identity",
    label: "身份与联系方式",
    detail: "ATS 最常见的姓名、邮箱、电话和中英文名字段。",
    keys: ["givenName", "familyName", "preferredName", "chineseName", "fullName", "email", "phone"]
  },
  {
    key: "location",
    label: "地区与联系渠道",
    detail: "跨中国大陆、新加坡、香港、澳洲时反复填写的地址和联系渠道。",
    keys: ["wechatId", "addressLine1", "city", "state", "country", "postalCode"]
  },
  {
    key: "links",
    label: "作品链接",
    detail: "LinkedIn、GitHub 和作品集链接，用于官网和 ATS 资料页。",
    keys: ["linkedInUrl", "githubUrl", "portfolioUrl"]
  },
  {
    key: "education",
    label: "教育背景",
    detail: "学校、学位、专业和毕业时间，校招/实习表单会频繁出现。",
    keys: ["school", "degree", "major", "graduationMonth", "graduationYear"]
  },
  {
    key: "preferences",
    label: "投递偏好",
    detail: "薪资、到岗、目标地点、渠道和推荐人默认只提示确认。",
    keys: ["salaryExpectation", "noticePeriod", "availableStartDate", "relocation", "workExperienceYears", "targetRole", "targetLocation", "sourceChannel", "referralName"]
  },
  {
    key: "compliance",
    label: "合规人工确认",
    detail: "工作权利、签证、国籍和证件信息只做识别提醒，不自动填写。",
    keys: ["workAuthorization", "visaSponsorship", "nationality", "dateOfBirth", "identityNumber"]
  }
];

const defaultJob = {
  market: "CN" as MarketCode,
  company: "",
  title: "",
  location: "",
  sourceUrl: "",
  description: "",
  matchScore: 70,
  visaRisk: "待判断",
  graduateFit: "中"
};

const defaultAnswer = {
  question: "",
  answer: "",
  market: "GLOBAL" as MarketCode,
  roleFamily: "通用",
  sensitivity: "REVIEW" as AnswerItem["sensitivity"]
};

const csvTemplate = "市场,公司,岗位,地点,链接,描述,匹配分\nCN,示例科技,后端开发实习生,上海,https://example.com/job,Java/Node 后端岗位,82";
const clipboardTemplate = `公司: 腾讯
岗位: 后端开发实习生
地点: 深圳
链接: https://join.qq.com/
描述: 校招/实习，Node Java SQL，适合后端开发方向，申请截止 2026-09-30

Software Engineer Intern | Shopee | Singapore | https://careers.shopee.sg/job/software-engineer-intern
Graduate Data Analyst - HSBC - Hong Kong - https://www.hsbc.com/careers/jobs/graduate-data-analyst

LinkedIn Job Alert
Backend Engineer Graduate
ByteDance
Shanghai
View job: https://jobs.bytedance.com/en/position/backend-engineer-graduate`;

const defaultSource = {
  name: "公司官网",
  market: "GLOBAL" as MarketCode,
  sourceType: "COMPANY_SITE",
  baseUrl: "",
  reliability: 85
};

const defaultResume = {
  name: "",
  market: "CN" as MarketCode,
  roleFamily: "Software / Data / BA",
  language: "zh",
  content: "",
  isDefault: false
};

const container: Variants = {
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02
    }
  }
};

const panelIn: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 120, damping: 18, mass: 0.7 }
  }
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }

  return payload as T;
}

function toneFromScore(score?: number | null) {
  if ((score ?? 0) >= 80) return "success";
  if ((score ?? 0) >= 65) return "info";
  if ((score ?? 0) >= 45) return "warning";
  return "danger";
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function dateOnly(value?: string | null) {
  const input = toDateInput(value);
  if (!input) return null;
  const date = new Date(`${input}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function followUpDaysUntil(value?: string | null) {
  const date = dateOnly(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function followUpDueLabel(value?: string | null) {
  const days = followUpDaysUntil(value);
  if (days === null) return "未排期";
  if (days < 0) return `逾期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  return `${days} 天后`;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromToday(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function followUpDayLabel(date: Date, offset: number) {
  if (offset === 0) return "今天";
  if (offset === 1) return "明天";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function activeFollowUp(application: Application) {
  return ["PREPARED", "APPLIED", "OA", "INTERVIEW"].includes(application.status);
}

function defaultFollowUpAction(status: ApplicationStatus) {
  if (status === "PREPARED") return "核对材料并完成官方申请表";
  if (status === "APPLIED") return "检查回信、笔试或面试通知";
  if (status === "OA") return "准备笔试并记录题目";
  if (status === "INTERVIEW") return "准备面试问题和复盘记录";
  return "更新投递进展";
}

function isDueFollowUp(application: Application) {
  const days = followUpDaysUntil(application.nextActionAt);
  return activeFollowUp(application) && days !== null && days <= 0;
}

function sortFollowUps(applications: Application[]) {
  return [...applications].sort((a, b) => {
    const aDays = followUpDaysUntil(a.nextActionAt) ?? 9999;
    const bDays = followUpDaysUntil(b.nextActionAt) ?? 9999;
    if (aDays !== bDays) return aDays - bDays;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function normalizeJobIdentity(job: Job) {
  return [job.market, job.company, job.title]
    .map((value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

function duplicateJobKeys(jobs: Job[]) {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const key = normalizeJobIdentity(job);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
}

function daysSince(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function jobQualityIssues(job: Job, duplicateKeys: Set<string>): JobQualityKey[] {
  const description = job.description.trim();
  const issues: JobQualityKey[] = [];

  if (!job.sourceUrl?.trim()) issues.push("MISSING_LINK");
  if (description.length < 80 || /待补充|从剪贴板导入|手动录入岗位/.test(description)) issues.push("SHORT_JD");
  if ((job.matchScore ?? 0) < 65) issues.push("LOW_SCORE");
  if ((job.visaRisk ?? "").includes("高")) issues.push("HIGH_RISK");
  if ((daysSince(job.lastSeenAt) ?? 0) > 45) issues.push("STALE");
  if (duplicateKeys.has(normalizeJobIdentity(job))) issues.push("DUPLICATE");

  return issues;
}

function formatDateTime(value?: string | null) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isSyncedToday(value?: string | null) {
  return Boolean(value && localDateKey(new Date(value)) === localDateKey(new Date()));
}

function draftTypeLabel(type: string) {
  const labels: Record<string, string> = {
    fit_summary: "JD 对齐卖点",
    resume_alignment: "简历对齐要点",
    cover_letter: "Cover Letter 草稿",
    screener_answers: "筛选题回答草稿"
  };
  return labels[type] ?? type;
}

function compactText(value: string, maxLength = 360) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function safeFileName(value: string) {
  const normalized = value
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || "careerpilot-apac-export").slice(0, 120);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function buildCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function profileFieldForKey(profile: Profile | null | undefined, key?: string | null): ProfileField | ProfileTemplateField | null {
  if (!key) return null;
  const profileField = profile?.fields.find((field) => field.key === key && field.value.trim()) ?? profile?.fields.find((field) => field.key === key);
  return profileField ?? profileTemplateMap.get(key) ?? null;
}

function fieldCandidateKey(field: FormSnapshotField) {
  return field.mappedKey || field.detectedKey || "";
}

function mappingRuleMatchesField(rule: FieldMappingRule, field: FormSnapshotField, candidateKey?: string | null) {
  if (candidateKey && rule.candidateKey !== candidateKey) return false;
  if (rule.formFieldId && rule.formFieldId === field.id) return true;
  if (rule.fieldFingerprint && rule.fieldFingerprint === field.fieldFingerprint) return true;
  if (rule.inputName && field.inputName && normalizeSearchText(rule.inputName) === normalizeSearchText(field.inputName)) return true;

  const ruleLabel = normalizeSearchText(rule.labelPattern || "");
  const fieldLabel = normalizeSearchText(field.label || "");
  return Boolean(ruleLabel && fieldLabel && (fieldLabel.includes(ruleLabel) || ruleLabel.includes(fieldLabel.slice(0, 80))));
}

type SnapshotReplayItem = {
  field: FormSnapshotField;
  candidateKey: string;
  profileField: ProfileField | ProfileTemplateField | null;
  effectiveSensitivity: Sensitivity;
  hasProfileValue: boolean;
  hasSavedRule: boolean;
  status: "ready" | "review" | "missing";
  reason: string;
};

function buildSnapshotReplay(snapshot: FormSnapshot | null, profile: Profile | null | undefined, mappingRules: FieldMappingRule[]) {
  const fields = snapshot?.fields ?? [];
  const items: SnapshotReplayItem[] = fields.map((field) => {
    const candidateKey = fieldCandidateKey(field);
    const profileField = profileFieldForKey(profile, candidateKey);
    const hasProfileValue = Boolean(profileField?.value?.trim());
    const hasSavedRule = Boolean(candidateKey && mappingRules.some((rule) => rule.enabled && mappingRuleMatchesField(rule, field, candidateKey)));
    const profileSensitivity = profileField?.sensitivity;
    const effectiveSensitivity: Sensitivity =
      field.sensitivity === "sensitive" || profileSensitivity === "sensitive"
        ? "sensitive"
        : field.sensitivity === "review" || profileSensitivity === "review"
          ? "review"
          : "safe";

    if (!candidateKey) {
      return {
        field,
        candidateKey,
        profileField,
        effectiveSensitivity,
        hasProfileValue,
        hasSavedRule,
        status: "missing",
        reason: "未识别到资料字段"
      };
    }

    if (effectiveSensitivity === "safe" && !hasProfileValue) {
      return {
        field,
        candidateKey,
        profileField,
        effectiveSensitivity,
        hasProfileValue,
        hasSavedRule,
        status: "missing",
        reason: "资料库缺少字段值"
      };
    }

    if (effectiveSensitivity === "safe" && hasProfileValue) {
      return {
        field,
        candidateKey,
        profileField,
        effectiveSensitivity,
        hasProfileValue,
        hasSavedRule,
        status: "ready",
        reason: hasSavedRule ? "已保存映射，可安全填写" : "可填写，建议保存映射"
      };
    }

    return {
      field,
      candidateKey,
      profileField,
      effectiveSensitivity,
      hasProfileValue,
      hasSavedRule,
      status: "review",
      reason: effectiveSensitivity === "sensitive" ? "敏感字段，只提示人工确认" : "需要人工确认后填写"
    };
  });

  const ready = items.filter((item) => item.status === "ready");
  const review = items.filter((item) => item.status === "review");
  const missing = items.filter((item) => item.status === "missing");
  const savedRules = items.filter((item) => item.hasSavedRule).length;
  const learnable = items.filter((item) => item.status === "ready" && !item.hasSavedRule).length;

  return {
    items,
    ready,
    review,
    missing,
    savedRules,
    learnable
  };
}

function snapshotReplayFieldLine(item: SnapshotReplayItem) {
  const profileLabel = item.profileField?.label || item.candidateKey || "未映射";
  const keyLabel = item.candidateKey ? `（${item.candidateKey}）` : "";
  const requiredLabel = item.field.required ? "必填" : "选填";
  const ruleLabel = item.hasSavedRule ? "已保存规则" : "未保存规则";
  return `- ${item.field.label || item.field.inputName || "未命名字段"} -> ${profileLabel}${keyLabel} · ${requiredLabel} · ${sensitivityLabels[item.effectiveSensitivity]} · ${ruleLabel} · ${item.reason}`;
}

function buildSnapshotReplayMarkdown(input: {
  snapshot: FormSnapshot;
  profile?: Profile | null;
  mappingRules: FieldMappingRule[];
  contextTitle?: string;
}) {
  const replay = buildSnapshotReplay(input.snapshot, input.profile, input.mappingRules);
  const lines = [
    `# CareerPilot APAC 表单回放清单`,
    "",
    `## ${input.contextTitle || input.snapshot.title || input.snapshot.host || "申请表单"}`,
    `- 表单：${input.snapshot.title || input.snapshot.host || "未命名表单"}`,
    `- ATS：${input.snapshot.atsVendor || "通用表单"}`,
    `- URL：${input.snapshot.url}`,
    `- 字段总数：${input.snapshot.fieldCount}`,
    `- 可直接填写：${replay.ready.length}`,
    `- 待人工确认：${replay.review.length}`,
    `- 缺映射/缺值：${replay.missing.length}`,
    `- 已保存映射规则：${replay.savedRules}`,
    `- 建议继续学习：${replay.learnable}`,
    "",
    "## 可直接填写",
    ...(replay.ready.length ? replay.ready.map(snapshotReplayFieldLine) : ["- 暂无可直接填写字段。"]),
    "",
    "## 待人工确认",
    ...(replay.review.length ? replay.review.map(snapshotReplayFieldLine) : ["- 暂无待确认字段。"]),
    "",
    "## 缺口",
    ...(replay.missing.length ? replay.missing.map(snapshotReplayFieldLine) : ["- 暂无缺口。"]),
    "",
    "## 下一步",
    "- 对可直接填写但未保存规则的字段，在填表资料库保存映射规则。",
    "- 对缺值字段，回到候选人资料补齐真实值后再填写。",
    "- 对待确认和敏感字段，只在官方表单中人工确认，不交给自动填写。",
    "",
    "## 操作边界",
    "- 这份清单只用于本地核对和复制，不代表已经提交申请。",
    "- Edge 扩展只辅助填写安全字段，不自动提交、不绕验证码、不自动上传文件。"
  ];

  return lines.join("\n");
}

function matchesSearch(value: string, query: string) {
  const normalizedValue = normalizeSearchText(value);
  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  return tokens.every((token) => normalizedValue.includes(token));
}

function parseImportIssues(value?: string | null): JobParseIssue[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function isSectionKey(value: string | null): value is SectionKey {
  return Boolean(value && navigation.some((item) => item.key === value));
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionKey>("today");
  const [selectedPackageJobId, setSelectedPackageJobId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [answers, setAnswers] = useState<AnswerItem[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [sources, setSources] = useState<JobSourceItem[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  const [formSnapshots, setFormSnapshots] = useState<FormSnapshot[]>([]);
  const [mappingRules, setMappingRules] = useState<FieldMappingRule[]>([]);
  const [autofillRuns, setAutofillRuns] = useState<AutofillRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在连接本地数据库...");
  const [setupMessage, setSetupMessage] = useState("按启用清单补齐本地闭环，完成后就能稳定按日使用。");
  const copy = sectionCopy[activeSection];

  async function loadDashboard() {
    setLoading(true);
    try {
      const [
        profileData,
        jobsData,
        applicationsData,
        answersData,
        planData,
        sourcesData,
        batchesData,
        resumesData,
        materialsData,
        snapshotsData,
        mappingRulesData,
        autofillRunsData
      ] = await Promise.all([
        fetchJson<{ profile: Profile }>("/api/profile"),
        fetchJson<{ jobs: Job[] }>("/api/jobs"),
        fetchJson<{ applications: Application[] }>("/api/applications"),
        fetchJson<{ items: AnswerItem[] }>("/api/answer-vault"),
        fetchJson<{ plan: DailyPlan | null }>("/api/daily-sprint/plan"),
        fetchJson<{ sources: JobSourceItem[] }>("/api/job-sources"),
        fetchJson<{ batches: ImportBatch[] }>("/api/import-batches"),
        fetchJson<{ resumes: ResumeVersion[] }>("/api/resumes"),
        fetchJson<{ drafts: MaterialDraft[] }>("/api/materials"),
        fetchJson<{ snapshots: FormSnapshot[] }>("/api/autofill/snapshots"),
        fetchJson<{ rules: FieldMappingRule[] }>("/api/autofill/mapping-rules?includeDisabled=1"),
        fetchJson<{ runs: AutofillRun[] }>("/api/autofill/runs")
      ]);

      setProfile(profileData.profile);
      setJobs(jobsData.jobs);
      setSelectedPackageJobId((current) => (jobsData.jobs.some((job) => job.id === current) ? current : jobsData.jobs[0]?.id ?? ""));
      setApplications(applicationsData.applications);
      setAnswers(answersData.items);
      setPlan(planData.plan);
      setSources(sourcesData.sources);
      setBatches(batchesData.batches);
      setResumes(resumesData.resumes);
      setMaterials(materialsData.drafts);
      setFormSnapshots(snapshotsData.snapshots);
      setMappingRules(mappingRulesData.rules);
      setAutofillRuns(autofillRunsData.runs);
      setMessage("本地数据已同步");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const section = params.get("section");
      const jobId = params.get("jobId");

      if (isSectionKey(section)) {
        setActiveSection(section);
      }

      if (jobId) {
        setSelectedPackageJobId(jobId);
      }

      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function openPackage(jobId: string) {
    setSelectedPackageJobId(jobId);
    setActiveSection("package");
    const nextUrl = `/?section=package&jobId=${encodeURIComponent(jobId)}`;
    window.history.replaceState(null, "", nextUrl);
  }

  const dueFollowUps = useMemo(() => sortFollowUps(applications.filter(isDueFollowUp)), [applications]);

  const metrics = useMemo(() => {
    const safeFields = profile?.fields.filter((field) => field.sensitivity === "safe").length ?? 0;
    const reviewFields = profile?.fields.filter((field) => field.sensitivity === "review").length ?? 0;
    const applied = applications.filter((item) => ["APPLIED", "OA", "INTERVIEW", "OFFER"].includes(item.status)).length;
    const interview = applications.filter((item) => ["OA", "INTERVIEW"].includes(item.status)).length;

    return {
      safeFields,
      reviewFields,
      applied,
      interview,
      dueFollowUps: dueFollowUps.length,
      jobs: jobs.length,
      answers: answers.length
    };
  }, [answers.length, applications, dueFollowUps.length, jobs.length, profile?.fields]);

  const setupItems = useMemo<SetupChecklistItem[]>(() => {
    const activeJobs = jobs.filter((job) => !job.archived);
    const profileFilledFields = profile?.fields.filter((field) => field.sensitivity !== "sensitive" && field.value.trim()).length ?? 0;
    const hasApplicationPackage = applications.length > 0 && materials.length > 0;
    const hasReusableAutofill = formSnapshots.length > 0 || mappingRules.some((rule) => rule.enabled);
    const backupRecords = jobs.length + applications.length + answers.length + resumes.length + materials.length + formSnapshots.length + mappingRules.length + autofillRuns.length;

    return [
      {
        key: "jobs",
        label: "岗位池",
        detail: activeJobs.length >= 3 ? `${activeJobs.length} 个未归档岗位可用于短名单` : `当前 ${activeJobs.length} 个未归档岗位，建议先导入更多目标`,
        done: activeJobs.length >= 3,
        target: "sources",
        actionLabel: "去导入岗位",
        tone: activeJobs.length >= 3 ? "success" : "warning",
        icon: Upload
      },
      {
        key: "profile",
        label: "填表资料",
        detail: profileFilledFields >= 10 ? `${profileFilledFields} 个字段已有值` : `已有 ${profileFilledFields} 个可用字段，建议补齐高频资料`,
        done: profileFilledFields >= 10,
        target: "autofill",
        actionLabel: "去补资料",
        tone: profileFilledFields >= 10 ? "success" : "warning",
        icon: ShieldCheck
      },
      {
        key: "plan",
        label: "今日节奏",
        detail: plan?.tasks.length ? `${plan.tasks.length} 个今日任务已生成` : "还没有今日计划",
        done: Boolean(plan?.tasks.length),
        target: "today",
        actionLabel: "去生成计划",
        tone: plan?.tasks.length ? "success" : "neutral",
        icon: Sparkles
      },
      {
        key: "package",
        label: "投递包",
        detail: hasApplicationPackage ? "已有申请记录和岗位材料" : "建议先为目标岗位生成材料包",
        done: hasApplicationPackage,
        target: "package",
        actionLabel: "去投递包",
        tone: hasApplicationPackage ? "success" : "info",
        icon: BadgeCheck
      },
      {
        key: "edge",
        label: "Edge 填表",
        detail: hasReusableAutofill ? `${formSnapshots.length} 个表单快照，${mappingRules.filter((rule) => rule.enabled).length} 条启用规则` : "还没有表单快照或映射规则",
        done: hasReusableAutofill,
        target: "autofill",
        actionLabel: "去学习字段",
        tone: hasReusableAutofill ? "success" : "info",
        icon: MousePointerClick
      },
      {
        key: "backup",
        label: "本地备份",
        detail: backupRecords ? `${backupRecords} 条本地记录可导出` : "暂无可备份记录",
        done: backupRecords > 0,
        target: "backup",
        actionLabel: "去备份",
        tone: backupRecords ? "success" : "neutral",
        icon: Archive
      }
    ];
  }, [answers.length, applications.length, autofillRuns.length, formSnapshots.length, jobs, mappingRules, materials.length, plan?.tasks, profile?.fields, resumes.length]);
  const setupDoneCount = setupItems.filter((item) => item.done).length;
  const setupPercent = setupItems.length ? Math.round((setupDoneCount / setupItems.length) * 100) : 0;
  const nextSetupItem = setupItems.find((item) => !item.done) ?? setupItems[0] ?? null;

  const opsItems = useMemo<OpsItem[]>(() => {
    const planTotal = plan?.tasks.length ?? 0;
    const planDone = plan?.tasks.filter((task) => task.status !== "queued").length ?? 0;
    const activeApplications = applications.filter((item) => !["REJECTED", "SKIPPED"].includes(item.status)).length;
    const preparedApplications = applications.filter((item) => ["PREPARED", "APPLIED", "OA", "INTERVIEW", "OFFER"].includes(item.status)).length;
    const dueFollowUpCount = dueFollowUps.length;
    const mappedFields = formSnapshots.reduce((sum, snapshot) => sum + snapshot.fields.filter((field) => field.mappedKey || field.detectedKey).length, 0);
    const backupRecords = jobs.length + applications.length + answers.length + resumes.length + materials.length + formSnapshots.length + mappingRules.length + autofillRuns.length;

    return [
      {
        key: "today",
        label: "今日节奏",
        value: planTotal ? `${planDone}/${planTotal}` : "未生成",
        detail: "短名单进度",
        tone: planTotal && planDone === planTotal ? "success" : planTotal ? "info" : "neutral",
        icon: Sparkles
      },
      {
        key: "applications",
        label: "投递管线",
        value: `${activeApplications}`,
        detail: dueFollowUpCount ? `${dueFollowUpCount} 个到期跟进` : `${preparedApplications} 个已准备`,
        tone: dueFollowUpCount ? "warning" : activeApplications ? "info" : "neutral",
        icon: BriefcaseBusiness
      },
      {
        key: "materials",
        label: "材料草稿",
        value: `${materials.length}`,
        detail: `${resumes.length} 个简历版本`,
        tone: materials.length ? "success" : "neutral",
        icon: Layers3
      },
      {
        key: "autofill",
        label: "填表资产",
        value: `${formSnapshots.length}`,
        detail: `${mappedFields} 个字段可复用`,
        tone: formSnapshots.length ? "success" : "warning",
        icon: ShieldCheck
      },
      {
        key: "backup",
        label: "本地备份",
        value: `${backupRecords}`,
        detail: "记录可导出恢复",
        tone: backupRecords ? "info" : "neutral",
        icon: Archive
      }
    ];
  }, [answers.length, applications, autofillRuns.length, dueFollowUps.length, formSnapshots, jobs.length, mappingRules.length, materials.length, plan?.tasks, resumes.length]);

  async function withBusy(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function syncJobSources(sourceId?: string) {
    let result: SourceSyncResponse | null = null;
    await withBusy(async () => {
      result = await fetchJson<SourceSyncResponse>("/api/job-sources/sync", {
        method: "POST",
        body: JSON.stringify(sourceId ? { sourceId } : { limit: 5 })
      });
      await loadDashboard();
    }, "公开来源同步完成");
    return result;
  }

  async function copySetupChecklist() {
    const lines = [
      `# CareerPilot APAC 本地启用清单 · ${localDateKey(new Date())}`,
      "",
      `- 完成度：${setupDoneCount}/${setupItems.length}，${setupPercent}%`,
      "",
      ...setupItems.map((item) => `- ${item.done ? "[x]" : "[ ]"} ${item.label}：${item.detail}`),
      "",
      nextSetupItem ? `下一步：${nextSetupItem.actionLabel} · ${nextSetupItem.label}` : "下一步：继续每日打卡。",
      "",
      "边界：本地启用清单只做状态提示和页面跳转，不自动投递、不自动提交、不绕验证码。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setSetupMessage("本地启用清单已复制。");
    } catch {
      setSetupMessage("复制失败，可以按清单卡片逐项处理。");
    }
  }

  const workflowIndex = Math.max(
    navigation.findIndex((item) => item.key === activeSection),
    0
  );

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main-workbench">
        跳到主工作区
      </a>
      <main className="dashboard-shell">
      <aside className="nav-rail">
        <div className="brand">
          <div className="brand-icon">
            <Radar size={18} />
          </div>
          <div>
            <strong>CareerPilot</strong>
            <span>APAC 求职控制台</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="CareerPilot 功能导航">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeSection;
            return (
              <button
                className={isActive ? "nav-link active" : "nav-link"}
                data-section={item.key}
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                aria-current={isActive ? "page" : undefined}
                type="button"
              >
                <span className="nav-dot">
                  <Icon size={14} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <section className="strategy-card" aria-label="本周策略调整">
          <span>策略调整</span>
          <strong>中国 + 新加坡</strong>
          <p>优先提高回信概率，澳洲保留少量高匹配投递。</p>
        </section>
      </aside>

      <motion.section className="workbench" id="main-workbench" key={activeSection} variants={container} initial={false} animate="show" tabIndex={-1}>
        <header className="workbench-header">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
        </header>

        <LocalRunStatusBar
          activeSection={activeSection}
          answers={answers}
          applications={applications}
          autofillRuns={autofillRuns}
          busy={busy}
          formSnapshots={formSnapshots}
          jobs={jobs}
          loading={loading}
          mappingRules={mappingRules}
          materials={materials}
          message={message}
          nextSetupItem={nextSetupItem}
          plan={plan}
          resumes={resumes}
          setupPercent={setupPercent}
        />

        <GlobalSearch
          answers={answers}
          applications={applications}
          jobs={jobs}
          materials={materials}
          onNavigate={setActiveSection}
          onOpenPackage={openPackage}
          resumes={resumes}
          sources={sources}
        />

        <WorkflowRibbon activeSection={activeSection} copy={copy} index={workflowIndex} onNavigate={setActiveSection} />

        <OpsStrip items={opsItems} activeSection={activeSection} onNavigate={setActiveSection} />

        <SetupChecklist
          doneCount={setupDoneCount}
          items={setupItems}
          message={setupMessage}
          nextItem={nextSetupItem}
          onCopy={copySetupChecklist}
          onNavigate={setActiveSection}
          percent={setupPercent}
        />

        {activeSection === "today" && (
          <TodayView
            jobs={jobs}
            plan={plan}
            sources={sources}
            metrics={metrics}
            followUps={dueFollowUps}
            busy={busy}
            onGeneratePlan={(targetCount) =>
              withBusy(async () => {
                const data = await fetchJson<{ plan: DailyPlan }>("/api/daily-sprint/plan", {
                  method: "POST",
                  body: JSON.stringify({ targetCount })
                });
                setPlan(data.plan);
              }, "今日打卡计划已生成")
            }
            onUpdateTask={(taskId, status) =>
              withBusy(async () => {
                const data = await fetchJson<{ plan: DailyPlan }>("/api/daily-sprint/tasks", {
                  method: "PATCH",
                  body: JSON.stringify({ id: taskId, status })
                });
                setPlan(data.plan);
                await loadDashboard();
              }, "每日任务已更新")
            }
            onCreateApplication={(jobId) =>
              withBusy(async () => {
                await fetchJson("/api/applications", {
                  method: "POST",
                  body: JSON.stringify({ jobId, status: "PREPARED", notes: "来自今日打卡计划" })
                });
                await loadDashboard();
              }, "已加入投递管线")
            }
            onSyncSources={() => syncJobSources()}
            onOpenSources={() => setActiveSection("sources")}
            onOpenPackage={openPackage}
          />
        )}
        {activeSection === "package" && (
          <PackageView
            jobs={jobs}
            profile={profile}
            selectedJobId={selectedPackageJobId}
            snapshots={formSnapshots}
            mappingRules={mappingRules}
            busy={busy}
            onSelectJob={setSelectedPackageJobId}
            onRefresh={loadDashboard}
          />
        )}
        {activeSection === "sources" && (
          <SourcesView
            sources={sources}
            batches={batches}
            busy={busy}
            onCreateSource={(source) =>
              withBusy(async () => {
                await fetchJson("/api/job-sources", {
                  method: "POST",
                  body: JSON.stringify(source)
                });
                await loadDashboard();
              }, "数据源已创建")
            }
            onUpdateSource={(source) =>
              withBusy(async () => {
                await fetchJson("/api/job-sources", {
                  method: "PATCH",
                  body: JSON.stringify(source)
                });
                await loadDashboard();
              }, "数据源已更新")
            }
            onParseClipboard={(text) => fetchJson<{ parsed: ParsedJob[]; issues: JobParseIssue[]; errors: number; total: number }>("/api/jobs/parse", {
              method: "POST",
              body: JSON.stringify({ text })
            })}
            onImportClipboard={(text, sourceName) =>
              withBusy(async () => {
                await fetchJson("/api/jobs/import/clipboard", {
                  method: "POST",
                  body: JSON.stringify({ text, sourceName })
                });
                await loadDashboard();
              }, "剪贴板岗位已导入")
            }
            onImportCsv={async (csv, sourceName) => {
              let result: CsvImportResult | null = null;
              await withBusy(async () => {
                result = await fetchJson<CsvImportResult>("/api/jobs/import", {
                  method: "POST",
                  body: JSON.stringify({ csv, sourceName })
                });
                await loadDashboard();
              }, "CSV 岗位已导入并去重");
              return result;
            }}
            onSyncSources={syncJobSources}
            onOpenMarkets={() => setActiveSection("markets")}
          />
        )}
        {activeSection === "materials" && (
          <MaterialsView
            jobs={jobs}
            resumes={resumes}
            materials={materials}
            busy={busy}
            onCreateResume={(resume) =>
              withBusy(async () => {
                await fetchJson("/api/resumes", {
                  method: "POST",
                  body: JSON.stringify(resume)
                });
                await loadDashboard();
              }, "简历版本已保存")
            }
            onUpdateResume={(resume) =>
              withBusy(async () => {
                await fetchJson("/api/resumes", {
                  method: "PATCH",
                  body: JSON.stringify(resume)
                });
                await loadDashboard();
              }, "简历版本已更新")
            }
            onGenerateMaterials={(jobId, resumeVersionId) =>
              withBusy(async () => {
                await fetchJson("/api/materials/generate", {
                  method: "POST",
                  body: JSON.stringify({ jobId, resumeVersionId })
                });
                await loadDashboard();
              }, "岗位材料包已生成")
            }
            onUpdateMaterial={(draft) =>
              withBusy(async () => {
                await fetchJson(`/api/materials/${draft.id}`, {
                  method: "PATCH",
                  body: JSON.stringify(draft)
                });
                await loadDashboard();
              }, "材料草稿已保存")
            }
            onLocalChange={setMaterials}
          />
        )}
        {activeSection === "autofill" && (
          <AutofillView
            profile={profile}
            metrics={metrics}
            snapshots={formSnapshots}
            mappingRules={mappingRules}
            runs={autofillRuns}
            busy={busy}
            onChangeProfile={setProfile}
            onSaveProfile={() =>
              withBusy(async () => {
                if (!profile) return;
                const data = await fetchJson<{ profile: Profile }>("/api/profile", {
                  method: "PUT",
                  body: JSON.stringify(profile)
                });
                setProfile(data.profile);
              }, "资料库已保存，Edge 扩展会读取最新数据")
            }
            onCreateMappingRule={(payload) =>
              withBusy(async () => {
                await fetchJson("/api/autofill/mapping-rules", {
                  method: "POST",
                  body: JSON.stringify(payload)
                });
                await loadDashboard();
              }, "字段映射规则已保存")
            }
            onCreateMappingRules={(payloads) =>
              withBusy(async () => {
                for (const payload of payloads) {
                  await fetchJson("/api/autofill/mapping-rules", {
                    method: "POST",
                    body: JSON.stringify(payload)
                  });
                }
                await loadDashboard();
              }, `已批量保存 ${payloads.length} 条字段映射规则`)
            }
            onUpdateMappingRule={(payload) =>
              withBusy(async () => {
                await fetchJson("/api/autofill/mapping-rules", {
                  method: "PATCH",
                  body: JSON.stringify(payload)
                });
                await loadDashboard();
              }, "字段映射规则已更新")
            }
          />
        )}
        {activeSection === "applications" && (
          <ApplicationsView
            jobs={jobs}
            applications={applications}
            busy={busy}
            onOpenPackage={openPackage}
            onCreateApplication={(jobId) =>
              withBusy(async () => {
                await fetchJson("/api/applications", {
                  method: "POST",
                  body: JSON.stringify({ jobId, status: "SAVED" })
                });
                await loadDashboard();
              }, "岗位已加入投递管线")
            }
            onUpdateApplication={(application) =>
              withBusy(async () => {
                await fetchJson("/api/applications", {
                  method: "PATCH",
                  body: JSON.stringify(application)
                });
                await loadDashboard();
              }, "投递状态已更新")
            }
            onScheduleFollowUps={(updates) =>
              withBusy(async () => {
                await Promise.all(
                  updates.map((application) =>
                    fetchJson("/api/applications", {
                      method: "PATCH",
                      body: JSON.stringify(application)
                    })
                  )
                );
                await loadDashboard();
              }, `已为 ${updates.length} 条投递排期`)
            }
          />
        )}
        {activeSection === "markets" && (
          <MarketsView
            jobs={jobs}
            busy={busy}
            onOpenPackage={openPackage}
            onAddJob={(job) =>
              withBusy(async () => {
                await fetchJson("/api/jobs", {
                  method: "POST",
                  body: JSON.stringify(job)
                });
                await loadDashboard();
              }, "岗位已入库")
            }
            onUpdateJob={(job) =>
              withBusy(async () => {
                await fetchJson("/api/jobs", {
                  method: "PATCH",
                  body: JSON.stringify(job)
                });
                await loadDashboard();
              }, "岗位信息已更新")
            }
            onImportCsv={(csv) =>
              withBusy(async () => {
                await fetchJson("/api/jobs/import", {
                  method: "POST",
                  body: JSON.stringify({ csv, sourceName: "市场雷达 CSV" })
                });
                await loadDashboard();
              }, "CSV 岗位已导入并去重")
            }
          />
        )}
        {activeSection === "interviews" && (
          <InterviewsView
            answers={answers}
            busy={busy}
            onAddAnswer={(answer) =>
              withBusy(async () => {
                await fetchJson("/api/answer-vault", {
                  method: "POST",
                  body: JSON.stringify(answer)
                });
                await loadDashboard();
              }, "题库答案已新增")
            }
            onUpdateAnswer={(answer) =>
              withBusy(async () => {
                await fetchJson("/api/answer-vault", {
                  method: "PATCH",
                  body: JSON.stringify(answer)
                });
                await loadDashboard();
              }, "题库答案已保存")
            }
            onLocalChange={setAnswers}
          />
        )}
        {activeSection === "backup" && (
          <BackupView
            profile={profile}
            jobs={jobs}
            applications={applications}
            answers={answers}
            resumes={resumes}
            materials={materials}
            snapshots={formSnapshots}
            mappingRules={mappingRules}
            runs={autofillRuns}
            onRestored={loadDashboard}
          />
        )}
      </motion.section>
      </main>
    </MotionConfig>
  );
}

type FeedbackTone = "success" | "info" | "warning" | "danger" | "neutral";

function LocalRunStatusBar({
  activeSection,
  answers,
  applications,
  autofillRuns,
  busy,
  formSnapshots,
  jobs,
  loading,
  mappingRules,
  materials,
  message,
  nextSetupItem,
  plan,
  resumes,
  setupPercent
}: {
  activeSection: SectionKey;
  answers: AnswerItem[];
  applications: Application[];
  autofillRuns: AutofillRun[];
  busy: boolean;
  formSnapshots: FormSnapshot[];
  jobs: Job[];
  loading: boolean;
  mappingRules: FieldMappingRule[];
  materials: MaterialDraft[];
  message: string;
  nextSetupItem: SetupChecklistItem | null;
  plan: DailyPlan | null;
  resumes: ResumeVersion[];
  setupPercent: number;
}) {
  const [copyMessage, setCopyMessage] = useState("本地运行状态可复制归档。");
  const localDate = localDateKey(new Date());
  const planTotal = plan?.tasks.length ?? 0;
  const planDone = plan?.tasks.filter((task) => task.status !== "queued").length ?? 0;
  const enabledRules = mappingRules.filter((rule) => rule.enabled).length;
  const backupRecords = jobs.length + applications.length + answers.length + resumes.length + materials.length + formSnapshots.length + mappingRules.length + autofillRuns.length;
  const activeApplications = applications.filter((application) => !["REJECTED", "SKIPPED"].includes(application.status)).length;
  const items = [
    {
      key: "date",
      label: "本地日期",
      value: localDate,
      detail: "Australia/Sydney",
      tone: "info" as const,
      icon: Radar
    },
    {
      key: "sync",
      label: "本地同步",
      value: loading ? "同步中" : "已同步",
      detail: message,
      tone: loading ? "warning" as const : "success" as const,
      icon: loading ? LoaderCircle : CheckCircle2
    },
    {
      key: "daily",
      label: "今日计划",
      value: planTotal ? `${planDone}/${planTotal}` : "未生成",
      detail: planTotal ? "短名单进度" : "先生成今日打卡",
      tone: planTotal && planDone === planTotal ? "success" as const : planTotal ? "info" as const : "warning" as const,
      icon: Sparkles
    },
    {
      key: "edge",
      label: "Edge 填表",
      value: `${formSnapshots.length} 快照`,
      detail: `${enabledRules} 条规则 · 不自动提交`,
      tone: formSnapshots.length || enabledRules ? "success" as const : "info" as const,
      icon: MousePointerClick
    },
    {
      key: "data",
      label: "本地数据",
      value: `${backupRecords}`,
      detail: `${activeApplications} 条活跃投递`,
      tone: backupRecords ? "success" as const : "warning" as const,
      icon: Archive
    }
  ];

  async function copyRunStatus() {
    const lines = [
      `# CareerPilot APAC 本地运行状态 · ${localDate}`,
      "",
      `- 当前页面：${sectionCopy[activeSection].title}`,
      `- 启用清单：${setupPercent}%`,
      `- 下一步：${nextSetupItem ? `${nextSetupItem.actionLabel} · ${nextSetupItem.label}` : "继续每日打卡"}`,
      `- 本地同步：${loading ? "同步中" : message}`,
      `- 今日计划：${planTotal ? `${planDone}/${planTotal}` : "未生成"}`,
      `- Edge 填表资产：${formSnapshots.length} 个快照，${enabledRules} 条启用规则`,
      `- 本地数据：${backupRecords} 条记录，${activeApplications} 条活跃投递`,
      "",
      "边界：本地状态只用于个人求职操作，不自动投递、不自动提交、不绕验证码。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyMessage("本地运行状态已复制。");
    } catch {
      setCopyMessage("复制失败，可以按状态条逐项查看。");
    }
  }

  return (
    <motion.section className="local-run-status" variants={panelIn}>
      <div className="local-run-copy">
        <span>本地运行状态</span>
        <strong>{setupPercent}% 就绪 · {sectionCopy[activeSection].title}</strong>
        <p>{copyMessage}</p>
      </div>
      <div className="local-run-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`local-run-card ${item.tone}`} key={item.key}>
              <Icon size={17} />
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </div>
            </article>
          );
        })}
      </div>
      <button className="secondary-button inline strong local-run-action" disabled={busy} onClick={copyRunStatus} type="button">
        <ClipboardList size={15} />
        复制运行状态
      </button>
    </motion.section>
  );
}

function WorkflowRibbon({
  activeSection,
  copy,
  index,
  onNavigate
}: {
  activeSection: SectionKey;
  copy: { title: string; subtitle: string };
  index: number;
  onNavigate: (section: SectionKey) => void;
}) {
  const previous = index > 0 ? navigation[index - 1] : null;
  const next = index < navigation.length - 1 ? navigation[index + 1] : null;
  const progress = ((index + 1) / navigation.length) * 100;

  return (
    <motion.div className="workflow-ribbon" variants={panelIn}>
      <div className="workflow-ribbon-copy">
        <span>流程定位</span>
        <strong>{copy.title}</strong>
        <p>
          第 {index + 1} / {navigation.length} 个工作面 · {copy.subtitle}
        </p>
      </div>

      <div className="workflow-progress" aria-label={`当前位于第 ${index + 1} 个工作面`}>
        <div className="workflow-progress-meta">
          <span>{navigation[0].label}</span>
          <span>{navigation[navigation.length - 1].label}</span>
        </div>
        <div className="workflow-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="workflow-dots" aria-label="流程节点导航">
          {navigation.map((item, dotIndex) => (
            <button
              aria-current={item.key === activeSection ? "step" : undefined}
              aria-label={`${item.label}，第 ${dotIndex + 1} 个工作面`}
              className={item.key === activeSection ? "current" : dotIndex < index ? "done" : ""}
              key={item.key}
              onClick={() => onNavigate(item.key)}
              title={item.label}
              type="button"
            />
          ))}
        </div>
      </div>

      <div className="workflow-actions" aria-label="流程导航">
        <button
          className="workflow-nav-button"
          disabled={!previous}
          onClick={() => previous && onNavigate(previous.key)}
          type="button"
        >
          <ChevronLeft size={16} />
          上一站
        </button>
        <button
          className="workflow-nav-button strong"
          disabled={!next}
          onClick={() => next && onNavigate(next.key)}
          type="button"
        >
          下一站
          <ChevronRight size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function OpsStrip({
  items,
  activeSection,
  onNavigate
}: {
  items: OpsItem[];
  activeSection: SectionKey;
  onNavigate: (section: SectionKey) => void;
}) {
  return (
    <motion.div className="ops-strip" variants={panelIn}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeSection;

        return (
          <button className={active ? `ops-tile ${item.tone} active` : `ops-tile ${item.tone}`} key={item.key} onClick={() => onNavigate(item.key)} type="button">
            <span className="ops-icon">
              <Icon size={16} />
            </span>
            <span className="ops-copy">
              <strong>{item.label}</strong>
              <em>{item.value}</em>
              <small>{item.detail}</small>
            </span>
          </button>
        );
      })}
    </motion.div>
  );
}

function SetupChecklist({
  items,
  doneCount,
  percent,
  message,
  nextItem,
  onNavigate,
  onCopy
}: {
  items: SetupChecklistItem[];
  doneCount: number;
  percent: number;
  message: string;
  nextItem: SetupChecklistItem | null;
  onNavigate: (section: SectionKey) => void;
  onCopy: () => void;
}) {
  return (
    <motion.section className="setup-checklist-panel" variants={panelIn}>
      <div className="setup-checklist-head">
        <div>
          <span>本地启用清单</span>
          <strong>{doneCount} / {items.length} 项完成</strong>
          <p>{message}</p>
        </div>
        <div className="setup-checklist-score">
          <strong>{percent}%</strong>
          <div className="progress-track">
            <span className="progress-fill success" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="setup-checklist-actions">
          {nextItem ? (
            <button className="secondary-button inline strong" onClick={() => onNavigate(nextItem.target)} type="button">
              {nextItem.actionLabel}
            </button>
          ) : null}
          <button className="secondary-button inline" onClick={onCopy} type="button">
            复制启用清单
          </button>
        </div>
      </div>
      <div className="setup-checklist-grid">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <button className={item.done ? "setup-check-card done" : `setup-check-card ${item.tone}`} key={item.key} onClick={() => onNavigate(item.target)} type="button">
              <span className="setup-check-icon">
                <Icon size={15} />
              </span>
              <strong>{item.label}</strong>
              <small>{item.done ? "已就绪" : "待处理"}</small>
              <p>{item.detail}</p>
            </button>
          );
        })}
      </div>
    </motion.section>
  );
}

function GlobalSearch({
  jobs,
  applications,
  materials,
  resumes,
  answers,
  sources,
  onNavigate,
  onOpenPackage
}: {
  jobs: Job[];
  applications: Application[];
  materials: MaterialDraft[];
  resumes: ResumeVersion[];
  answers: AnswerItem[];
  sources: JobSourceItem[];
  onNavigate: (section: SectionKey) => void;
  onOpenPackage: (jobId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("搜索公司、岗位、材料、题库或数据源，直接跳到对应工作面。");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const index = useMemo<GlobalSearchResult[]>(() => {
    const items: GlobalSearchResult[] = [];

    for (const job of jobs) {
      items.push({
        key: `job-${job.id}`,
        label: "岗位",
        title: `${job.company} · ${job.title}`,
        detail: `${marketLabels[job.market]} · ${job.location || "地点待补"} · 匹配 ${job.matchScore ?? 0} · ${job.visaRisk || "风险待判断"}`,
        target: "package",
        jobId: job.id
      });
    }

    for (const application of applications) {
      items.push({
        key: `application-${application.id}`,
        label: "投递",
        title: `${application.job.company} · ${application.job.title}`,
        detail: `${statusLabels[application.status]} · ${application.nextAction || application.notes || "待补下一步"}${application.nextActionAt ? ` · ${toDateInput(application.nextActionAt)}` : ""}`,
        target: "package",
        jobId: application.jobId
      });
    }

    for (const material of materials) {
      items.push({
        key: `material-${material.id}`,
        label: "材料",
        title: `${draftTypeLabel(material.draftType)} · ${material.job.company}`,
        detail: `${material.job.title} · ${material.title} · ${compactText(material.content, 96)}`,
        target: "package",
        jobId: material.jobId
      });
    }

    for (const resume of resumes) {
      items.push({
        key: `resume-${resume.id}`,
        label: "简历",
        title: resume.name,
        detail: `${resume.market ? marketLabels[resume.market] : "通用"} · ${resume.roleFamily} · ${resume.language}`,
        target: "materials"
      });
    }

    for (const answer of answers) {
      items.push({
        key: `answer-${answer.id}`,
        label: "题库",
        title: answer.question,
        detail: `${answer.market ? marketLabels[answer.market] : "通用"} · ${answer.roleFamily || "未分类"} · ${compactText(answer.answer, 96)}`,
        target: "interviews"
      });
    }

    for (const source of sources) {
      items.push({
        key: `source-${source.id}`,
        label: "数据源",
        title: source.name,
        detail: `${marketLabels[source.market]} · ${source.sourceType} · 可靠度 ${source.reliability}% · ${source.enabled ? "已启用" : "已停用"}`,
        target: "sources"
      });
    }

    return items;
  }, [answers, applications, jobs, materials, resumes, sources]);
  const normalizedQuery = query.trim();
  const results: GlobalSearchResult[] = normalizedQuery
    ? index.filter((item) => matchesSearch(`${item.label} ${item.title} ${item.detail}`, normalizedQuery)).slice(0, 8)
    : [
        ...applications.filter(activeFollowUp).slice(0, 3).map((application) => ({
          key: `suggest-application-${application.id}`,
          label: "继续跟进",
          title: `${application.job.company} · ${application.job.title}`,
          detail: `${statusLabels[application.status]} · ${application.nextAction || application.notes || "补齐下一步动作"}`,
          target: "package" as SectionKey,
          jobId: application.jobId
        })),
        ...jobs.slice(0, 3).map((job) => ({
          key: `suggest-job-${job.id}`,
          label: "高匹配岗位",
          title: `${job.company} · ${job.title}`,
          detail: `${marketLabels[job.market]} · 匹配 ${job.matchScore ?? 0} · ${job.location || "地点待补"}`,
          target: "package" as SectionKey,
          jobId: job.id
        }))
      ].slice(0, 6);
  const activeIndex = results.length ? Math.min(selectedIndex, results.length - 1) : 0;

  function openResult(result: GlobalSearchResult) {
    if (result.jobId) {
      onOpenPackage(result.jobId);
    } else {
      onNavigate(result.target);
    }
    setMessage(`已打开：${result.title}`);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setMessage("已聚焦全局搜索。");
        return;
      }

      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        event.preventDefault();
        setQuery("");
        setSelectedIndex(0);
        inputRef.current?.blur();
        setMessage("已退出全局搜索。");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <motion.section className="global-search-panel" variants={panelIn}>
      <div className="global-search-row">
        <label className="global-search-input">
          <Search size={17} />
          <input
            aria-label="全局搜索"
            placeholder="搜索公司、岗位、材料、题库、数据源"
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && results.length) {
                event.preventDefault();
                setSelectedIndex((current) => (current + 1) % results.length);
              }

              if (event.key === "ArrowUp" && results.length) {
                event.preventDefault();
                setSelectedIndex((current) => (current - 1 + results.length) % results.length);
              }

              if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                openResult(results[activeIndex]);
              }

              if (event.key === "Escape") {
                event.preventDefault();
                setQuery("");
                setSelectedIndex(0);
                inputRef.current?.blur();
                setMessage("已退出全局搜索。");
              }
            }}
          />
        </label>
        <span className="global-search-count">
          {normalizedQuery ? `命中 ${results.length} / ${index.length}` : `本地索引 ${index.length} 条`}
        </span>
      </div>
      <div className="global-search-meta">
        <p>{message}</p>
        {normalizedQuery ? (
          <button
            className="secondary-button inline"
            onClick={() => {
              setQuery("");
              setSelectedIndex(0);
            }}
            type="button"
          >
            清空搜索
          </button>
        ) : null}
      </div>
      {results.length ? (
        <div className="global-search-results">
          {results.map((result, index) => (
            <button
              aria-current={index === activeIndex ? "true" : undefined}
              className={index === activeIndex ? "active" : undefined}
              key={result.key}
              onClick={() => openResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              type="button"
            >
              <span>{result.label}</span>
              <strong>{result.title}</strong>
              <small>{result.detail}</small>
            </button>
          ))}
        </div>
      ) : (
        <div className="global-search-empty">
          <strong>没有匹配结果</strong>
          <span>换一个公司、岗位、市场、题库关键词或数据源名称试试。</span>
        </div>
      )}
    </motion.section>
  );
}

function BackupView({
  profile,
  jobs,
  applications,
  answers,
  resumes,
  materials,
  snapshots,
  mappingRules,
  runs,
  onRestored
}: {
  profile: Profile | null;
  jobs: Job[];
  applications: Application[];
  answers: AnswerItem[];
  resumes: ResumeVersion[];
  materials: MaterialDraft[];
  snapshots: FormSnapshot[];
  mappingRules: FieldMappingRule[];
  runs: AutofillRun[];
  onRestored: () => Promise<void>;
}) {
  const [backupText, setBackupText] = useState("");
  const [backupFileName, setBackupFileName] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restoreResult, setRestoreResult] = useState<BackupImportResult | null>(null);
  const [restoreMessage, setRestoreMessage] = useState("选择 CareerPilot APAC 导出的 JSON 文件后先做预检。");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [health, setHealth] = useState<TextEncodingHealth | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthMessage, setHealthMessage] = useState("打开页面后会自动检查中文编码和数据库异常。");
  const backupItems = [
    { label: "候选人资料字段", value: profile?.fields.length ?? 0 },
    { label: "岗位", value: jobs.length },
    { label: "投递记录", value: applications.length },
    { label: "题库答案", value: answers.length },
    { label: "简历版本", value: resumes.length },
    { label: "材料草稿", value: materials.length },
    { label: "表单快照", value: snapshots.length },
    { label: "映射规则", value: mappingRules.length },
    { label: "填表运行", value: runs.length }
  ];
  const previewItems: Array<{ key: BackupCountKey; label: string }> = [
    { key: "profiles", label: "资料档案" },
    { key: "profileFields", label: "资料字段" },
    { key: "jobs", label: "岗位" },
    { key: "applications", label: "投递记录" },
    { key: "plans", label: "每日计划" },
    { key: "answers", label: "题库答案" },
    { key: "resumes", label: "简历版本" },
    { key: "materialDrafts", label: "材料草稿" },
    { key: "formSnapshots", label: "表单快照" },
    { key: "mappingRules", label: "映射规则" },
    { key: "autofillRuns", label: "填表运行" },
    { key: "autofillContexts", label: "Edge 上下文" }
  ];
  const totalBackupRecords = backupItems.reduce((sum, item) => sum + item.value, 0);
  const maintenanceCommands = [
    "npm run verify",
    "npm run smoke:cleanup -w @careerpilot/web",
    "npm run docs:check",
    "npm run visual:smoke -w @careerpilot/web"
  ];
  const healthChecks = [
    {
      key: "encoding",
      label: "中文编码健康",
      done: health?.ok === true,
      detail: health ? `文件异常 ${health.files.length}，数据库异常 ${health.database.length}` : "等待自动检查"
    },
    {
      key: "backup",
      label: "本地备份可导出",
      done: totalBackupRecords > 0,
      detail: `${totalBackupRecords} 条本地记录可进入 JSON 快照`
    },
    {
      key: "verify",
      label: "完整验收命令",
      done: true,
      detail: "npm run verify 会覆盖文档、构建、API、视觉和清理"
    },
    {
      key: "cleanup",
      label: "Smoke 数据清理",
      done: true,
      detail: "只清理 __careerpilot_smoke_* 测试来源和测试 URL"
    }
  ];

  const runHealthCheck = useCallback(async () => {
    setHealthBusy(true);
    try {
      const data = await fetchJson<TextEncodingHealth>("/api/health/text-encoding");
      setHealth(data);
      setHealthMessage(data.ok ? "本地健康检查通过，未发现中文乱码或数据库异常。" : "健康检查发现异常，请先查看文件和数据库命中项。");
    } catch (error) {
      setHealth(null);
      setHealthMessage(error instanceof Error ? error.message : "健康检查失败");
    } finally {
      setHealthBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runHealthCheck();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [runHealthCheck]);

  async function copyMaintenanceCommands() {
    try {
      await navigator.clipboard.writeText(maintenanceCommands.join("\n"));
      setHealthMessage("本地维护命令已复制。");
    } catch {
      setHealthMessage("复制失败，可以直接按面板里的命令运行。");
    }
  }

  function readBackupFile(file?: File) {
    setPreview(null);
    setRestoreResult(null);
    if (!file) {
      setBackupText("");
      setBackupFileName("");
      setRestoreMessage("选择 CareerPilot APAC 导出的 JSON 文件后先做预检。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBackupText(String(reader.result ?? ""));
      setBackupFileName(file.name);
      setRestoreMessage("文件已读取，先预检结构和记录数量。");
    };
    reader.onerror = () => {
      setBackupText("");
      setBackupFileName("");
      setRestoreMessage("文件读取失败，请重新选择 JSON 备份。");
    };
    reader.readAsText(file, "utf-8");
  }

  async function previewBackup() {
    if (!backupText.trim()) {
      setRestoreMessage("请先选择一个 JSON 备份文件。");
      return;
    }

    setRestoreBusy(true);
    try {
      const data = await fetchJson<{ preview: BackupPreview }>("/api/backup/preview", {
        method: "POST",
        body: backupText
      });
      setPreview(data.preview);
      setRestoreResult(null);
      setRestoreMessage(data.preview.ok ? "预检通过，可以合并恢复。" : "预检发现结构错误，不能导入。");
    } catch (error) {
      setRestoreMessage(error instanceof Error ? error.message : "备份预检失败");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function restoreBackup() {
    if (!preview?.ok || !backupText.trim()) {
      setRestoreMessage("请先完成预检，且确认没有结构错误。");
      return;
    }

    setRestoreBusy(true);
    try {
      const data = await fetchJson<{ result: BackupImportResult }>("/api/backup/import", {
        method: "POST",
        body: backupText
      });
      setRestoreResult(data.result);
      setRestoreMessage("合并恢复完成，工作台数据已重新加载。");
      await onRestored();
    } catch (error) {
      setRestoreMessage(error instanceof Error ? error.message : "备份恢复失败");
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <div className="view-stack">
      <motion.section className="panel backup-panel local-health-panel" variants={panelIn}>
        <div className="panel-title">
          <div>
            <h2>本地健康检查</h2>
            <p>{healthMessage}</p>
          </div>
          <button className="secondary-button inline strong" disabled={healthBusy} onClick={runHealthCheck} type="button">
            {healthBusy ? "检查中" : "重新检查"}
          </button>
        </div>
        <div className="health-check-grid">
          {healthChecks.map((check) => (
            <article className={check.done ? "health-check-card done" : "health-check-card warning"} key={check.key}>
              <span>{check.done ? "通过" : "待处理"}</span>
              <strong>{check.label}</strong>
              <p>{check.detail}</p>
            </article>
          ))}
        </div>
        <div className="maintenance-command-panel">
          <div>
            <strong>本地维护命令</strong>
            <span>验证、清理 smoke 数据、检查文档和视觉截图。</span>
          </div>
          <code>{maintenanceCommands.join("\n")}</code>
          <button className="secondary-button inline strong" onClick={copyMaintenanceCommands} type="button">
            复制维护命令
          </button>
        </div>
      </motion.section>

      <motion.section className="panel backup-panel" variants={panelIn}>
        <div className="panel-title">
          <div>
            <h2>本地 JSON 备份</h2>
            <p>导出的是当前本机 SQLite 数据快照，包含岗位、材料、题库、表单快照和字段映射规则。</p>
          </div>
          <Archive size={20} />
        </div>
        <div className="backup-grid">
          {backupItems.map((item) => (
            <Metric key={item.label} label={item.label} value={String(item.value)} />
          ))}
        </div>
        <a className="fill-button backup-download" href="/api/backup/export">
          导出本地备份 JSON
        </a>
        <p className="helper-text">导出文件可用于换机器、误删后恢复或阶段性留档。敏感字段仍只保存在你的本机 JSON 里。</p>
      </motion.section>

      <motion.section className="panel backup-panel" variants={panelIn}>
        <div className="panel-title">
          <div>
            <h2>备份恢复</h2>
            <p>恢复采用合并模式：同 ID 记录会更新，新 ID 记录会新增，不会清空或删除当前本地数据。</p>
          </div>
          <Upload size={20} />
        </div>
        <div className="backup-restore">
          <label className="file-picker">
            选择 JSON 备份
            <input accept="application/json,.json" type="file" onChange={(event) => readBackupFile(event.target.files?.[0])} />
          </label>
          <div className="restore-actions">
            <button className="secondary-button inline strong" disabled={restoreBusy || !backupText} onClick={previewBackup} type="button">
              预检备份
            </button>
            <button className="fill-button compact-button" disabled={restoreBusy || !preview?.ok} onClick={restoreBackup} type="button">
              合并恢复
            </button>
          </div>
        </div>

        <div className="restore-status">
          <strong>{backupFileName || "尚未选择文件"}</strong>
          <span>{restoreMessage}</span>
        </div>

        {preview && (
          <div className="backup-preview">
            <div className={preview.ok ? "restore-verdict ok" : "restore-verdict danger"}>
              <strong>{preview.ok ? "结构可导入" : "结构不可导入"}</strong>
              <span>
                {preview.product || "未知产品"} · schema {preview.schemaVersion ?? "未知"} · {preview.exportedAt ? formatDateTime(preview.exportedAt) : "无导出时间"}
              </span>
            </div>
            <div className="backup-preview-grid">
              {previewItems.map((item) => (
                <Metric key={item.key} label={item.label} value={String(preview.counts[item.key] ?? 0)} />
              ))}
            </div>
            {preview.errors.length > 0 && (
              <div className="backup-message-list danger">
                {preview.errors.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
            {preview.warnings.length > 0 && (
              <div className="backup-message-list warning">
                {preview.warnings.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {restoreResult && (
          <div className="backup-message-list success">
            <span>
              已合并恢复：岗位 {restoreResult.imported.jobs}、投递 {restoreResult.imported.applications}、材料 {restoreResult.imported.materialDrafts}、表单快照 {restoreResult.imported.formSnapshots}。
            </span>
            <span>
              已跳过：岗位 {restoreResult.skipped.jobs}、投递 {restoreResult.skipped.applications}、表单字段 {restoreResult.skipped.formFields}。
            </span>
          </div>
        )}
      </motion.section>
    </div>
  );
}

function TodayView({
  jobs,
  plan,
  sources,
  metrics,
  followUps,
  busy,
  onGeneratePlan,
  onUpdateTask,
  onCreateApplication,
  onSyncSources,
  onOpenSources,
  onOpenPackage
}: {
  jobs: Job[];
  plan: DailyPlan | null;
  sources: JobSourceItem[];
  metrics: { applied: number; interview: number; answers: number; dueFollowUps: number };
  followUps: Application[];
  busy: boolean;
  onGeneratePlan: (targetCount: number) => void;
  onUpdateTask: (taskId: string, status: "prepared" | "applied" | "skipped") => void;
  onCreateApplication: (jobId: string) => void;
  onSyncSources: () => Promise<SourceSyncResponse | null>;
  onOpenSources: () => void;
  onOpenPackage: (jobId: string) => void;
}) {
  const [targetCount, setTargetCount] = useState(5);
  const [planExportMessage, setPlanExportMessage] = useState("今日计划生成后可复制或下载归档。");
  const [refreshMessage, setRefreshMessage] = useState("每天先刷新公开来源，再生成今日计划。");
  const [refreshResult, setRefreshResult] = useState<SourceSyncResponse | null>(null);
  const topJobs = jobs.slice(0, 3);
  const tasks = plan?.tasks ?? [];
  const handledTasks = tasks.filter((task) => task.status !== "queued");
  const preparedTasks = tasks.filter((task) => task.status === "prepared");
  const appliedTasks = tasks.filter((task) => task.status === "applied");
  const skippedTasks = tasks.filter((task) => task.status === "skipped");
  const queuedTasks = tasks.filter((task) => task.status === "queued");
  const completionPercent = tasks.length ? Math.round((handledTasks.length / tasks.length) * 100) : 0;
  const sprintMinutes = Math.max(6, queuedTasks.length * 4 + preparedTasks.length * 2);
  const planStatusText = plan?.status === "completed" ? "今日计划已完成" : tasks.length ? `还剩 ${queuedTasks.length} 个任务` : "等待生成计划";
  const primaryFollowUp = followUps[0] ?? null;
  const primaryQueuedTask = queuedTasks[0] ?? null;
  const primaryTopJob = topJobs[0] ?? null;
  const syncableSources = sources.filter((source) => source.enabled && Boolean(source.baseUrl?.trim()) && source.sourceType !== "MANUAL");
  const syncedTodaySources = syncableSources.filter((source) => isSyncedToday(source.lastSyncedAt));
  const staleSources = syncableSources.filter((source) => !isSyncedToday(source.lastSyncedAt));
  const latestSourceSyncLog =
    syncableSources
      .flatMap((source) => (source.syncLogs ?? []).filter((log) => log.action === "source_sync").map((log) => ({ ...log, sourceName: source.name })))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
  const refreshedImported = refreshResult?.totals.imported ?? 0;
  const refreshedDeduped = refreshResult?.totals.deduped ?? 0;
  const refreshStatusText = syncableSources.length
    ? staleSources.length
      ? `${staleSources.length} 个公开来源今天未同步`
      : "今天公开来源已刷新"
    : "暂无可同步公开来源";
  const dailyActionItems = [
    staleSources.length
      ? {
          key: "source-refresh",
          label: "先刷新岗位",
          title: refreshStatusText,
          detail: `同步公司官网、ATS 或邮件提醒公开 URL，再决定今日短名单`,
          tone: "info",
          actionLabel: "刷新公开来源",
          onAction: () => {
            void syncDailySources();
          }
        }
      : null,
    primaryFollowUp
      ? {
          key: "follow-up",
          label: "先跟进",
          title: `${primaryFollowUp.job.company} · ${primaryFollowUp.job.title}`,
          detail: `${followUpDueLabel(primaryFollowUp.nextActionAt)} · ${primaryFollowUp.nextAction || primaryFollowUp.notes || "补齐下一步动作"}`,
          tone: "warning",
          actionLabel: "打开投递包",
          onAction: () => onOpenPackage(primaryFollowUp.jobId)
        }
      : null,
    primaryQueuedTask
      ? {
          key: "queued-task",
          label: "继续短名单",
          title: `${primaryQueuedTask.job.company} · ${primaryQueuedTask.job.title}`,
          detail: `匹配 ${primaryQueuedTask.matchScore ?? primaryQueuedTask.job.matchScore ?? 0} · ${marketLabels[primaryQueuedTask.job.market]} · 先核对材料和申请链接`,
          tone: "info",
          actionLabel: "打开投递包",
          onAction: () => onOpenPackage(primaryQueuedTask.job.id)
        }
      : null,
    !tasks.length
      ? {
          key: "generate-plan",
          label: "建立今日节奏",
          title: "生成今日打卡计划",
          detail: `从 ${jobs.length} 个岗位中生成 ${targetCount} 个今日目标，只生成待办，不自动投递`,
          tone: "neutral",
          actionLabel: "生成计划",
          onAction: () => onGeneratePlan(targetCount)
        }
      : null,
    !primaryFollowUp && !primaryQueuedTask && primaryTopJob
      ? {
          key: "top-job",
          label: "补充候选",
          title: `${primaryTopJob.company} · ${primaryTopJob.title}`,
          detail: `当前无紧急跟进，建议检查高匹配岗位并准备材料`,
          tone: "success",
          actionLabel: "打开投递包",
          onAction: () => onOpenPackage(primaryTopJob.id)
        }
      : null
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    title: string;
    detail: string;
    tone: "success" | "info" | "warning" | "neutral";
    actionLabel: string;
    onAction: () => void;
  }>;
  const primaryAction = dailyActionItems[0] ?? null;

  async function syncDailySources() {
    setRefreshMessage("正在刷新启用的公开来源...");
    const result = await onSyncSources();

    if (!result) {
      setRefreshResult(null);
      setRefreshMessage("公开来源刷新未完成，请查看顶部状态后重试。");
      return;
    }

    setRefreshResult(result);
    setRefreshMessage(result.message);
  }

  function buildDailyPlanMarkdown() {
    if (!tasks.length) return "";
    const date = localDateKey(new Date());
    const lines = [
      `# CareerPilot APAC 今日打卡 · ${date}`,
      "",
      "## 今日进度",
      `- 状态：${planStatusText}`,
      `- 预计耗时：${sprintMinutes} 分钟`,
      `- 完成率：${completionPercent}%`,
      `- 已处理：${handledTasks.length}/${tasks.length}`,
      `- 已准备：${preparedTasks.length}`,
      `- 已投递：${appliedTasks.length}`,
      `- 已跳过：${skippedTasks.length}`,
      `- 到期跟进：${metrics.dueFollowUps}`,
      `- 公开来源：${syncedTodaySources.length}/${syncableSources.length} 今日已同步`,
      "",
      "## 今日短名单",
      ...tasks.flatMap((task, index) => [
        "",
        `### ${index + 1}. ${task.job.company} · ${task.job.title}`,
        `- 市场：${marketLabels[task.job.market]}`,
        `- 地点：${task.job.location || "地点待补充"}`,
        `- 状态：${taskStatusLabels[task.status] ?? task.status}`,
        `- 匹配分：${task.matchScore ?? task.job.matchScore ?? 0}`,
        `- 风险：${task.riskLevel ?? task.job.visaRisk ?? "待判断"}`,
        `- 岗位链接：${task.job.sourceUrl || "未补充"}`,
        task.package?.coverLetterDraft ? `- 材料提示：${compactText(task.package.coverLetterDraft, 260)}` : "- 材料提示：未生成"
      ]),
      "",
      "## 今日跟进",
      ...(followUps.length
        ? followUps.slice(0, 6).map((application) => `- ${followUpDueLabel(application.nextActionAt)}：${application.job.company} · ${application.job.title} · ${application.nextAction || application.notes || "补齐下一步动作"}`)
        : ["- 暂无到期跟进"]),
      "",
      "## 操作边界",
      "- 公开来源刷新只读取你配置的公开 URL，不登录、不绕限制、不自动投递。",
      "- 今日计划只用于整理短名单和人工跟进，不自动投递、不自动提交、不绕验证码。",
      "- 真实提交后回到 CareerPilot APAC 标记状态，并记录回信、笔试、面试或复盘。"
    ];

    return lines.join("\n");
  }

  async function copyDailyPlan() {
    const markdown = buildDailyPlanMarkdown();
    if (!markdown) {
      setPlanExportMessage("请先生成今日计划。");
      return;
    }

    try {
      await navigator.clipboard.writeText(markdown);
      setPlanExportMessage("今日计划 Markdown 已复制。");
    } catch {
      setPlanExportMessage("复制失败，可以先下载今日计划 Markdown。");
    }
  }

  async function copyDailyActionQueue() {
    const lines = [
      `# CareerPilot APAC 今日行动队列 · ${localDateKey(new Date())}`,
      "",
      `- 今日计划：${planStatusText}`,
      `- 预计耗时：${sprintMinutes} 分钟`,
      `- 到期跟进：${metrics.dueFollowUps}`,
      `- 公开来源：${syncableSources.length ? `${syncedTodaySources.length}/${syncableSources.length} 今日已同步` : "未配置"}`,
      "",
      "## 优先动作",
      ...(dailyActionItems.length
        ? dailyActionItems.map((item, index) => `${index + 1}. ${item.label}：${item.title} - ${item.detail}`)
        : ["1. 暂无明确动作，建议先导入岗位或生成今日计划。"]),
      "",
      "边界：行动队列和公开来源刷新只做本地排序、岗位入库和人工提示，不自动投递、不自动提交、不绕验证码。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setPlanExportMessage("今日行动队列已复制。");
    } catch {
      setPlanExportMessage("复制失败，可以直接按行动队列处理。");
    }
  }

  function downloadDailyPlan() {
    const markdown = buildDailyPlanMarkdown();
    if (!markdown) {
      setPlanExportMessage("请先生成今日计划。");
      return;
    }

    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-今日打卡计划`)}.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setPlanExportMessage(`已下载 ${filename}。`);
  }

  return (
    <>
      <div className="top-grid">
        <motion.section className="sprint-card" variants={panelIn}>
          <div className="section-kicker">
            <Sparkles size={16} />
            今日投递冲刺
          </div>
          <div className="sprint-time">{sprintMinutes} 分钟</div>
          <p>{planStatusText}。按短名单逐个确认岗位、材料和最终动作。</p>
          <div className="progress-track dark">
            <span className="progress-fill success" style={{ width: `${tasks.length ? Math.max(8, completionPercent) : 8}%` }} />
          </div>
          <div className="sprint-blocks">
            <div className="sprint-block">
              <span>今日进度</span>
              <strong>{completionPercent}%</strong>
            </div>
            <div className="sprint-block">
              <span>已处理</span>
              <strong>{handledTasks.length} / {tasks.length}</strong>
            </div>
            <div className="sprint-block">
              <span>已投递</span>
              <strong>{appliedTasks.length} 个任务</strong>
            </div>
            <div className="sprint-block">
              <span>跳过</span>
              <strong>{skippedTasks.length} 个任务</strong>
            </div>
          </div>
        </motion.section>

        <motion.section className="panel autofill-panel" variants={panelIn}>
          <div className="panel-title">
            <div>
              <h2>生成今日计划</h2>
              <p>按匹配分、市场和已投递状态生成短名单。</p>
            </div>
            <BadgeCheck size={20} />
          </div>
          <div className="inline-form">
            <label>
              今日目标数
              <input min="1" max="12" type="number" value={targetCount} onChange={(event) => setTargetCount(Number(event.target.value))} />
            </label>
            <button className="fill-button compact-button" disabled={busy} onClick={() => onGeneratePlan(targetCount)} type="button">
              生成打卡计划
              <ChevronRight size={18} />
            </button>
          </div>
          <p className="helper-text">生成计划不会自动投递，只会把岗位加入待办短名单。</p>
        </motion.section>
      </div>

      <motion.section className="panel daily-refresh-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>每日岗位刷新</h2>
            <p>从已配置公开来源更新岗位库，再生成今日短名单。</p>
          </div>
          <RefreshCw size={19} />
        </div>
        <div className="daily-refresh-grid">
          <Metric label="公开来源" value={String(syncableSources.length)} tone={syncableSources.length ? "success" : undefined} />
          <Metric label="今日已同步" value={String(syncedTodaySources.length)} tone={syncedTodaySources.length ? "success" : undefined} />
          <Metric label="待刷新" value={String(staleSources.length)} tone={staleSources.length ? "warning" : "success"} />
          <Metric label="新增/去重" value={`${refreshedImported}/${refreshedDeduped}`} />
        </div>
        <div className="daily-refresh-actions">
          <span>{refreshMessage}</span>
          <div>
            <button className="secondary-button inline strong" disabled={busy || !syncableSources.length} onClick={syncDailySources} type="button">
              刷新公开来源
            </button>
            <button className="secondary-button inline" disabled={busy} onClick={onOpenSources} type="button">
              管理数据源
            </button>
          </div>
        </div>
        <div className="daily-refresh-list">
          {syncableSources.slice(0, 4).map((source) => (
            <article className={isSyncedToday(source.lastSyncedAt) ? "daily-refresh-source done" : "daily-refresh-source"} key={source.id}>
              <strong>{source.name}</strong>
              <span>{marketLabels[source.market]} · {source.sourceType} · {source.lastSyncedAt ? formatDateTime(source.lastSyncedAt) : "未同步"}</span>
            </article>
          ))}
          {!syncableSources.length ? (
            <div className="daily-refresh-empty">
              <strong>暂无公开来源</strong>
              <span>去数据源页添加公司官网、ATS 或邮件提醒 URL。</span>
            </div>
          ) : null}
        </div>
        {latestSourceSyncLog ? (
          <p className="helper-text">最近同步：{latestSourceSyncLog.sourceName} · {latestSourceSyncLog.status} · {latestSourceSyncLog.message || "无说明"}</p>
        ) : (
          <p className="helper-text">公开来源刷新不会登录外部平台，也不会自动提交申请。</p>
        )}
      </motion.section>

      <motion.section className="panel daily-progress-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>打卡进度</h2>
            <p>按今日短名单实时计算，已准备、已投递和已跳过都会计入已处理。</p>
          </div>
          <BadgeCheck size={19} />
        </div>
        <div className="daily-progress-grid">
          <Metric label="完成率" value={`${completionPercent}%`} tone={completionPercent >= 100 ? "success" : undefined} />
          <Metric label="待处理" value={String(queuedTasks.length)} />
          <Metric label="已准备" value={String(preparedTasks.length)} tone={preparedTasks.length ? "success" : undefined} />
          <Metric label="已投递" value={String(appliedTasks.length)} tone={appliedTasks.length ? "success" : undefined} />
          <Metric label="已跳过" value={String(skippedTasks.length)} />
          <Metric label="到期跟进" value={String(metrics.dueFollowUps)} />
        </div>
      </motion.section>

      <motion.section className="panel daily-action-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>今日行动队列</h2>
            <p>把到期跟进、短名单和高匹配岗位压成下一步动作，减少每天重新判断优先级的时间。</p>
          </div>
          <div className="daily-action-actions">
            <button className="secondary-button inline" disabled={busy || !dailyActionItems.length} onClick={copyDailyActionQueue} type="button">
              复制行动队列
            </button>
            {primaryAction ? (
              <button className="secondary-button inline strong" disabled={busy} onClick={primaryAction.onAction} type="button">
                打开第一项
              </button>
            ) : null}
          </div>
        </div>
        {dailyActionItems.length ? (
          <div className="daily-action-grid">
            {dailyActionItems.slice(0, 3).map((item, index) => (
              <article className={`daily-action-card ${item.tone}`} key={item.key}>
                <span>{index + 1}. {item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <button className="secondary-button inline strong" disabled={busy} onClick={item.onAction} type="button">
                  {item.actionLabel}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无行动队列" detail="先导入岗位或生成今日计划，系统会自动排出下一步动作。" tone="info" icon={Sparkles} />
        )}
      </motion.section>

      <div className="middle-grid">
        <MarketSummary jobs={jobs} />
        <RecommendedRoles jobs={topJobs} onOpenPackage={onOpenPackage} />
      </div>

      <motion.section className="panel due-follow-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>今日跟进</h2>
            <p>优先处理已经到期或逾期的回信、笔试、面试和材料动作。</p>
          </div>
          <BadgeCheck size={19} />
        </div>
        {followUps.length ? (
          <div className="due-follow-list">
            {followUps.slice(0, 4).map((application) => (
              <article className={followUpDaysUntil(application.nextActionAt)! < 0 ? "due-follow-card overdue" : "due-follow-card"} key={application.id}>
                <div>
                  <div className="task-title-row">
                    <strong>{application.job.company}</strong>
                    <span className="status-chip applied">{followUpDueLabel(application.nextActionAt)}</span>
                  </div>
                  <span>{application.job.title} · {statusLabels[application.status]}</span>
                  <p>{application.nextAction || application.notes || "补齐下一步动作"}</p>
                </div>
                <button className="secondary-button inline strong" disabled={busy} onClick={() => onOpenPackage(application.jobId)} type="button">
                  打开投递包
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="今天没有到期跟进" detail="设置投递记录的跟进日期后，到期和逾期动作会自动出现在这里。" tone="success" icon={BadgeCheck} />
        )}
      </motion.section>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>今日短名单</h2>
            <p>{planExportMessage}</p>
          </div>
          <div className="daily-plan-actions">
            <button className="secondary-button inline strong" disabled={busy || !tasks.length} onClick={copyDailyPlan} type="button">
              复制今日计划
            </button>
            <button className="secondary-button inline" disabled={busy || !tasks.length} onClick={downloadDailyPlan} type="button">
              下载今日计划.md
            </button>
          </div>
        </div>
        {plan?.tasks.length ? (
          <div className="task-list">
            {plan.tasks.map((task) => (
              <article className="task-card" key={task.id}>
                <div>
                  <div className="task-title-row">
                    <strong>{task.job.title}</strong>
                    <span className={`status-chip ${task.status}`}>{taskStatusLabels[task.status] ?? task.status}</span>
                  </div>
                  <span>
                    {task.job.company} · {marketLabels[task.job.market]} · 匹配 {task.matchScore ?? task.job.matchScore ?? 0} · 风险 {task.riskLevel ?? "待判断"}
                  </span>
                  {task.package?.coverLetterDraft ? <p>{task.package.coverLetterDraft}</p> : null}
                </div>
                <div className="task-actions">
                  <button className="secondary-button inline" disabled={busy || task.status !== "queued"} onClick={() => onUpdateTask(task.id, "prepared")} type="button">
                    准备材料
                  </button>
                  <button className="secondary-button inline strong" disabled={busy || task.status === "applied"} onClick={() => onUpdateTask(task.id, "applied")} type="button">
                    标记投递
                  </button>
                  <button className="secondary-button inline" disabled={busy || task.status === "skipped"} onClick={() => onUpdateTask(task.id, "skipped")} type="button">
                    跳过
                  </button>
                  <button className="secondary-button inline" disabled={busy} onClick={() => onCreateApplication(task.job.id)} type="button">
                    加入管线
                  </button>
                  <button className="secondary-button inline strong" disabled={busy} onClick={() => onOpenPackage(task.job.id)} type="button">
                    打开投递包
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有今日计划" detail="点击生成打卡计划，会从岗位库里挑出今天最值得处理的岗位。" tone="info" icon={Sparkles} />
        )}
      </motion.section>
    </>
  );
}

function PackageView({
  jobs,
  profile,
  selectedJobId,
  snapshots,
  mappingRules,
  busy,
  onSelectJob,
  onRefresh
}: {
  jobs: Job[];
  profile: Profile | null;
  selectedJobId: string;
  snapshots: FormSnapshot[];
  mappingRules: FieldMappingRule[];
  busy: boolean;
  onSelectJob: (jobId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [data, setData] = useState<JobPackageDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [message, setMessage] = useState("选择岗位后会加载投递包。");
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [applicationDraft, setApplicationDraft] = useState<Pick<Application, "id" | "status" | "notes" | "appliedAt" | "responseAt" | "nextAction" | "nextActionAt"> | null>(null);
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null;
  const currentJob = data?.job ?? selectedJob;
  const isBusy = busy || localBusy || loading;
  const availableSnapshots = data?.availableSnapshots?.length
    ? data.availableSnapshots
    : snapshots.filter((snapshot) => !data?.application || !snapshot.applicationId || snapshot.applicationId === data.application.id).slice(0, 8);
  const boundSnapshots = data?.boundSnapshots ?? [];
  const safeFieldCount = boundSnapshots.reduce((sum, snapshot) => sum + snapshot.safeCount, 0);
  const reviewFieldCount = boundSnapshots.reduce((sum, snapshot) => sum + snapshot.reviewCount, 0);
  const enabledMappingRules = data?.mappingRuleCount ?? mappingRules.filter((rule) => rule.enabled).length;
  const selectedAvailableSnapshot = availableSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? null;
  const packageReplaySnapshot = boundSnapshots[0] ?? selectedAvailableSnapshot;
  const packageReplay = buildSnapshotReplay(packageReplaySnapshot, profile, mappingRules);
  const packageStatus = data?.application?.status;
  const hasSubmitted = packageStatus ? ["APPLIED", "OA", "INTERVIEW", "OFFER", "REJECTED"].includes(packageStatus) : false;
  const submissionChecklist = [
    {
      key: "jobLink",
      label: "岗位链接",
      done: Boolean(currentJob?.sourceUrl),
      detail: currentJob?.sourceUrl ? compactText(currentJob.sourceUrl, 96) : "先在市场雷达补齐岗位链接"
    },
    {
      key: "application",
      label: "申请记录",
      done: Boolean(data?.application),
      detail: data?.application ? statusLabels[data.application.status] : "先创建申请记录"
    },
    {
      key: "materials",
      label: "材料草稿",
      done: (data?.drafts.length ?? 0) >= 3,
      detail: `${data?.drafts.length ?? 0} 份材料`
    },
    {
      key: "snapshot",
      label: "表单快照",
      done: boundSnapshots.length > 0,
      detail: boundSnapshots.length ? `已绑定 ${boundSnapshots.length} 个快照` : "用 Edge 扩展扫描并保存申请表"
    },
    {
      key: "edgeContext",
      label: "Edge 当前申请",
      done: Boolean(data?.edgeContext?.active),
      detail: data?.edgeContext?.active ? `有效至 ${formatDateTime(data.edgeContext.expiresAt)}` : "提交前设为当前 Edge 申请"
    },
    {
      key: "manualSubmit",
      label: "人工最终提交",
      done: hasSubmitted,
      detail: hasSubmitted ? "已进入投递后跟进" : "真实提交后回到这里标记已投递"
    }
  ];
  const submissionChecklistDone = submissionChecklist.filter((item) => item.done).length;

  const syncPackage = useCallback((nextPackage: JobPackageDetails, nextMessage: string) => {
    setData(nextPackage);
    setApplicationDraft(
      nextPackage.application
        ? {
            id: nextPackage.application.id,
            status: nextPackage.application.status,
            notes: nextPackage.application.notes ?? "",
            appliedAt: toDateInput(nextPackage.application.appliedAt),
            responseAt: toDateInput(nextPackage.application.responseAt),
            nextAction: nextPackage.application.nextAction ?? "",
            nextActionAt: toDateInput(nextPackage.application.nextActionAt)
          }
        : null
    );
    setSelectedSnapshotId((current) => {
      if (current && nextPackage.availableSnapshots.some((snapshot) => snapshot.id === current)) return current;
      return nextPackage.availableSnapshots[0]?.id ?? "";
    });
    setMessage(nextMessage);
  }, []);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchJson<{ package: JobPackageDetails }>(`/api/jobs/${selectedJobId}/package`)
        .then((payload) => {
          if (!cancelled) {
            syncPackage(payload.package, "投递包已加载");
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setData(null);
            setApplicationDraft(null);
            setMessage(error instanceof Error ? error.message : "投递包加载失败");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedJobId, syncPackage]);

  async function reloadPackage(nextMessage: string) {
    if (!selectedJobId) return;
    const payload = await fetchJson<{ package: JobPackageDetails }>(`/api/jobs/${selectedJobId}/package`);
    syncPackage(payload.package, nextMessage);
  }

  async function runPackageAction(action: () => Promise<void>) {
    setLocalBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setLocalBusy(false);
    }
  }

  async function createApplication() {
    await runPackageAction(async () => {
      await fetchJson(`/api/jobs/${selectedJobId}/package/application`, {
        method: "POST",
        body: JSON.stringify({ status: "PREPARED" })
      });
      await onRefresh();
      await reloadPackage("申请记录已创建，可以继续生成材料或绑定表单快照。");
    });
  }

  async function saveApplication() {
    if (!applicationDraft) return;
    await runPackageAction(async () => {
      await fetchJson("/api/applications", {
        method: "PATCH",
        body: JSON.stringify(applicationDraft)
      });
      await onRefresh();
      await reloadPackage("申请状态已保存");
    });
  }

  async function generateMaterials() {
    await runPackageAction(async () => {
      await fetchJson("/api/materials/generate", {
        method: "POST",
        body: JSON.stringify({
          jobId: selectedJobId,
          resumeVersionId: data?.recommendedResume?.id
        })
      });
      await onRefresh();
      await reloadPackage("材料包已生成或刷新");
    });
  }

  function updatePackageDraft(id: string, patch: Partial<MaterialDraft>) {
    setData((current) =>
      current
        ? {
            ...current,
            drafts: current.drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
          }
        : current
    );
  }

  async function copyPackageDraft(draft: MaterialDraft) {
    try {
      await navigator.clipboard.writeText(`${draft.title}\n\n${draft.content}`);
      setMessage(`已复制：${draft.title}`);
    } catch {
      setMessage("复制失败，可以直接选中文本手动复制。");
    }
  }

  async function savePackageDraft(draft: MaterialDraft) {
    await runPackageAction(async () => {
      await fetchJson(`/api/materials/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: draft.title,
          content: draft.content,
          status: draft.status
        })
      });
      await onRefresh();
      await reloadPackage("材料草稿已保存，投递包已同步最新内容。");
    });
  }

  async function bindSnapshot() {
    if (!data?.application || !selectedSnapshotId) return;
    await runPackageAction(async () => {
      await fetchJson(`/api/autofill/snapshots/${selectedSnapshotId}`, {
        method: "PATCH",
        body: JSON.stringify({ applicationId: data.application?.id })
      });
      await onRefresh();
      await reloadPackage("表单快照已绑定到当前申请记录");
    });
  }

  async function activateEdgeContext() {
    if (!data?.application) return;
    await runPackageAction(async () => {
      await fetchJson("/api/autofill/context", {
        method: "POST",
        body: JSON.stringify({
          applicationId: data.application?.id,
          jobId: data.job.id,
          urlHint: data.job.sourceUrl,
          ttlMinutes: 120
        })
      });
      await reloadPackage("已设为当前 Edge 填表申请，2 小时内保存的表单快照会自动绑定。");
    });
  }

  async function clearEdgeContext() {
    await runPackageAction(async () => {
      await fetchJson("/api/autofill/context", {
        method: "DELETE"
      });
      await reloadPackage("已清除当前 Edge 填表申请。");
    });
  }

  async function markSubmitted() {
    if (!data?.application) return;
    await runPackageAction(async () => {
      await fetchJson("/api/applications", {
        method: "PATCH",
        body: JSON.stringify({
          id: data.application?.id,
          status: "APPLIED",
          appliedAt: localDateKey(new Date()),
          notes: applicationDraft?.notes ?? data.application?.notes ?? ""
        })
      });
      await onRefresh();
      await reloadPackage("已标记为已投递，后续可以记录回信、笔试或面试进展。");
    });
  }

  async function copySubmissionChecklist() {
    if (!currentJob) return;
    const lines = [
      `${currentJob.company} · ${currentJob.title}`,
      `岗位链接：${currentJob.sourceUrl || "未补充"}`,
      "",
      ...submissionChecklist.map((item) => `${item.done ? "[x]" : "[ ]"} ${item.label} - ${item.detail}`),
      "",
      "边界：只辅助填写和人工核对，不自动提交、不绕验证码。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setMessage("提交前检查清单已复制。");
    } catch {
      setMessage("复制失败，可以按清单逐项人工核对。");
    }
  }

  function buildPackageSummaryMarkdown() {
    if (!currentJob) return "";
    const application = applicationDraft ?? data?.application;
    const lines = [
      `# ${currentJob.company} · ${currentJob.title}`,
      "",
      "## 岗位信息",
      `- 市场：${marketLabels[currentJob.market]}`,
      `- 地点：${currentJob.location || "待补充"}`,
      `- 岗位链接：${currentJob.sourceUrl || "未补充"}`,
      `- 匹配分：${currentJob.matchScore ?? 0}`,
      `- 签证风险：${currentJob.visaRisk ?? "待判断"}`,
      `- 毕业生匹配：${currentJob.graduateFit ?? "待判断"}`,
      `- JD 摘要：${compactText(currentJob.description || "暂无 JD 描述", 520)}`,
      "",
      "## 解析结果",
      data?.parseResult
        ? `- 关键词：${data.parseResult.keywords.length ? data.parseResult.keywords.join("、") : "暂无"}`
        : "- 关键词：暂无解析结果",
      data?.parseResult
        ? `- 加分原因：${data.parseResult.positiveReasons.length ? data.parseResult.positiveReasons.join("；") : "暂无"}`
        : "- 加分原因：暂无解析结果",
      data?.parseResult
        ? `- 扣分/风险：${[...data.parseResult.negativeReasons, ...data.parseResult.riskSignals].length ? [...data.parseResult.negativeReasons, ...data.parseResult.riskSignals].join("；") : "暂无"}`
        : "- 扣分/风险：暂无解析结果",
      data?.parseResult ? `- 截止时间：${data.parseResult.deadline ? toDateInput(data.parseResult.deadline) : "未识别"}` : "- 截止时间：未识别",
      "",
      "## 申请状态",
      `- 当前状态：${application ? statusLabels[application.status] : "未创建申请记录"}`,
      `- 投递日期：${application?.appliedAt || "未记录"}`,
      `- 回信日期：${application?.responseAt || "未记录"}`,
      `- 下次跟进：${application?.nextActionAt || "未安排"}`,
      `- 下一步动作：${application?.nextAction || "未填写"}`,
      `- 备注：${application?.notes || "未填写"}`,
      "",
      "## 准备度",
      data?.readiness ? `- 总体：${data.readiness.doneCount}/${data.readiness.totalCount} 项，${data.readiness.percent}%` : "- 总体：未加载",
      ...submissionChecklist.map((item) => `- ${item.done ? "[x]" : "[ ]"} ${item.label}：${item.detail}`),
      "",
      "## 投递材料",
      `- 推荐简历：${data?.recommendedResume?.name ?? "未配置"}`,
      ...(data?.drafts.length
        ? data.drafts.flatMap((draft) => [
            "",
            `### ${draftTypeLabel(draft.draftType)} · ${draft.title}`,
            `- 状态：${materialStatusLabels[draft.status] ?? draft.status}`,
            compactText(draft.content.trim() || "暂无内容", 900)
          ])
        : ["- 暂无材料草稿"]),
      "",
      "## Edge 表单",
      `- 绑定快照：${boundSnapshots.length} 个`,
      `- 安全字段：${safeFieldCount}`,
      `- 待确认字段：${reviewFieldCount}`,
      `- 映射规则：${enabledMappingRules}`,
      `- 当前 Edge 申请：${data?.edgeContext?.active ? `已设置，有效至 ${formatDateTime(data.edgeContext.expiresAt)}` : "未设置"}`,
      ...(boundSnapshots.length
        ? boundSnapshots.slice(0, 4).map((snapshot) => `- 快照：${snapshot.title || snapshot.host || "未命名表单"} · ${snapshot.atsVendor || "通用表单"} · 字段 ${snapshot.fieldCount}`)
        : ["- 快照：暂无绑定表单快照"]),
      "",
      "## Edge 表单回放",
      packageReplaySnapshot
        ? `- 当前回放：${packageReplaySnapshot.title || packageReplaySnapshot.host || "未命名表单"}`
        : "- 当前回放：暂无表单快照",
      packageReplaySnapshot ? `- 可直接填写：${packageReplay.ready.length}` : "- 可直接填写：0",
      packageReplaySnapshot ? `- 待人工确认：${packageReplay.review.length}` : "- 待人工确认：0",
      packageReplaySnapshot ? `- 缺映射/缺值：${packageReplay.missing.length}` : "- 缺映射/缺值：0",
      ...(packageReplaySnapshot
        ? [
            "",
            "### 可直接填写字段",
            ...(packageReplay.ready.length ? packageReplay.ready.slice(0, 10).map(snapshotReplayFieldLine) : ["- 暂无"]),
            "",
            "### 待确认字段",
            ...(packageReplay.review.length ? packageReplay.review.slice(0, 10).map(snapshotReplayFieldLine) : ["- 暂无"]),
            "",
            "### 缺口字段",
            ...(packageReplay.missing.length ? packageReplay.missing.slice(0, 10).map(snapshotReplayFieldLine) : ["- 暂无"])
          ]
        : []),
      "",
      "## 题库引用",
      ...(data?.answers.length
        ? data.answers.slice(0, 5).map((answer) => `- ${answer.question}：${compactText(answer.answer, 260)}`)
        : ["- 暂无题库引用"]),
      "",
      "## 操作边界",
      "- 只辅助填写和人工核对，不自动提交、不绕验证码、不自动上传文件。",
      "- 真实提交后回到 CareerPilot APAC 标记状态，并记录回信、笔试、面试或复盘。"
    ];

    return lines.join("\n");
  }

  async function copyPackageSummary() {
    const markdown = buildPackageSummaryMarkdown();
    if (!markdown) return;

    try {
      await navigator.clipboard.writeText(markdown);
      setMessage("投递包 Markdown 摘要已复制。");
    } catch {
      setMessage("复制失败，可以先复制清单或手动整理投递包信息。");
    }
  }

  function downloadPackageSummary() {
    if (!currentJob) return;
    const markdown = buildPackageSummaryMarkdown();
    if (!markdown) return;
    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-${currentJob.company}-${currentJob.title}-投递包`)}.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(`已下载 ${filename}。`);
  }

  const nextStep = (() => {
    if (!data) {
      return {
        tone: "neutral",
        title: "正在读取投递包",
        detail: "系统会把岗位、申请记录、材料草稿、表单快照和题库引用合并到当前工作台。",
        action: "none" as const
      };
    }

    if (!data.application) {
      return {
        tone: "warning",
        title: "先创建申请记录",
        detail: "创建后才能绑定 Edge 表单快照、记录投递状态，并把这个岗位纳入后续跟进。",
        action: "createApplication" as const
      };
    }

    if (data.drafts.length < 3) {
      return {
        tone: "warning",
        title: "生成材料包",
        detail: "当前材料还不完整，先生成 JD 对齐卖点、Cover Letter 大纲和筛选题回答草稿。",
        action: "generateMaterials" as const
      };
    }

    if (!boundSnapshots.length) {
      return selectedSnapshotId
        ? {
            tone: "warning",
            title: "绑定最近表单快照",
            detail: "把 Edge 保存的申请表快照绑定到当前申请，后续填表运行和字段映射才会进入同一个岗位上下文。",
            action: "bindSnapshot" as const
          }
        : {
            tone: "info",
            title: "打开申请页并保存表单快照",
            detail: "先设为当前 Edge 申请，然后在真实申请页用扩展扫描并保存快照；最终提交仍由你人工确认。",
            action: "activateEdge" as const
          };
    }

    if (!hasSubmitted) {
      return {
        tone: "success",
        title: "可以进入人工提交",
        detail: "资料、材料和表单快照都已就绪。打开岗位链接，用 Edge 辅助填写，提交后回到这里标记状态。",
        action: "openApply" as const
      };
    }

    return {
      tone: "success",
      title: "进入投递后跟进",
      detail: "这个岗位已经进入投递管线，下一步记录回信、笔试、面试安排和复盘结论。",
      action: "reviewPipeline" as const
    };
  })();

  if (!jobs.length) {
    return (
      <motion.section className="panel" variants={panelIn}>
        <EmptyState title="岗位库为空" detail="先从市场雷达或数据源导入岗位，投递包会自动把岗位、材料和表单快照串起来。" tone="warning" icon={BriefcaseBusiness} />
      </motion.section>
    );
  }

  return (
    <div className="view-stack package-view">
      <motion.section className="panel package-toolbar" variants={panelIn}>
        <label>
          目标岗位
          <select value={selectedJobId} onChange={(event) => onSelectJob(event.target.value)}>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.company} · {job.title}
              </option>
            ))}
          </select>
        </label>
        <div className="package-toolbar-actions">
          <span className="helper-text">{message}</span>
          {currentJob?.sourceUrl ? (
            <a className="secondary-button inline strong" href={currentJob.sourceUrl} rel="noreferrer" target="_blank">
              打开岗位链接
            </a>
          ) : null}
        </div>
      </motion.section>

      {currentJob ? (
        <>
          <motion.section className="package-hero" variants={panelIn}>
            <div>
              <span className="section-kicker">
                <BriefcaseBusiness size={16} />
                {marketLabels[currentJob.market]} · {currentJob.location || "地点待补充"}
              </span>
              <h2>{currentJob.company} · {currentJob.title}</h2>
              <p>{currentJob.description || "暂无 JD 描述，建议先补充岗位原文后再生成材料包。"}</p>
            </div>
            <div className="package-score-card">
              <span>匹配分</span>
              <strong className={toneFromScore(currentJob.matchScore)}>{currentJob.matchScore ?? 0}</strong>
              <em>签证风险 {currentJob.visaRisk ?? "待判断"} · 毕业生匹配 {currentJob.graduateFit ?? "待判断"}</em>
            </div>
          </motion.section>

          <motion.section className={`panel package-next-step ${nextStep.tone}`} variants={panelIn}>
            <div className="next-step-copy">
              <span>下一步动作</span>
              <h2>{nextStep.title}</h2>
              <p>{nextStep.detail}</p>
            </div>
            <div className="next-step-actions">
              {nextStep.action === "createApplication" ? (
                <button className="fill-button compact-button" disabled={isBusy} onClick={createApplication} type="button">
                  创建申请记录
                </button>
              ) : null}
              {nextStep.action === "generateMaterials" ? (
                <button className="fill-button compact-button" disabled={isBusy} onClick={generateMaterials} type="button">
                  生成材料包
                </button>
              ) : null}
              {nextStep.action === "bindSnapshot" ? (
                <button className="fill-button compact-button" disabled={isBusy || !selectedSnapshotId} onClick={bindSnapshot} type="button">
                  绑定表单快照
                </button>
              ) : null}
              {nextStep.action === "activateEdge" ? (
                <button className="fill-button compact-button" disabled={isBusy} onClick={activateEdgeContext} type="button">
                  设为当前 Edge 申请
                </button>
              ) : null}
              {nextStep.action === "openApply" ? (
                <>
                  {currentJob.sourceUrl ? (
                    <a className="fill-button compact-button" href={currentJob.sourceUrl} rel="noreferrer" target="_blank">
                      打开岗位链接
                    </a>
                  ) : null}
                  <button className="secondary-button inline strong" disabled={isBusy} onClick={markSubmitted} type="button">
                    人工提交后标记已投递
                  </button>
                </>
              ) : null}
              {nextStep.action === "reviewPipeline" ? (
                <button className="secondary-button inline strong" disabled={isBusy} onClick={saveApplication} type="button">
                  保存跟进记录
                </button>
              ) : null}
            </div>
          </motion.section>

          <motion.section className="panel package-submit-checklist" variants={panelIn}>
            <div className="panel-title compact">
              <div>
                <h2>提交前检查清单</h2>
                <p>{submissionChecklistDone} / {submissionChecklist.length} 项完成，真实提交前保留人工最终确认。</p>
              </div>
              <div className="package-copy-actions">
                <button className="secondary-button inline strong" disabled={isBusy || !currentJob} onClick={copyPackageSummary} type="button">
                  复制投递包摘要
                </button>
                <button className="secondary-button inline" disabled={isBusy || !currentJob} onClick={downloadPackageSummary} type="button">
                  下载摘要.md
                </button>
                <button className="secondary-button inline strong" disabled={isBusy || !currentJob} onClick={copySubmissionChecklist} type="button">
                  复制清单
                </button>
              </div>
            </div>
            <div className="submit-check-grid">
              {submissionChecklist.map((item) => (
                <article className={item.done ? "submit-check-item done" : "submit-check-item"} key={item.key}>
                  <span>{item.done ? "完成" : "待处理"}</span>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </motion.section>

          {data?.readiness ? (
            <motion.section className="panel package-readiness" variants={panelIn}>
              <div className="panel-title compact">
                <div>
                  <h2>投递准备度</h2>
                  <p>{data.readiness.doneCount} / {data.readiness.totalCount} 项完成，提交前保留人工最终确认。</p>
                </div>
                <strong>{data.readiness.percent}%</strong>
              </div>
              <div className="progress-track">
                <span className="progress-fill success" style={{ width: `${data.readiness.percent}%` }} />
              </div>
              <div className="readiness-list">
                {data.readiness.checks.map((check) => (
                  <article className={check.done ? "readiness-item done" : "readiness-item"} key={check.key}>
                    <span>{check.done ? "完成" : "待处理"}</span>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                  </article>
                ))}
              </div>
            </motion.section>
          ) : null}

          <div className="package-grid">
            <motion.section className="panel package-panel" variants={panelIn}>
              <div className="panel-title compact">
                <h2>岗位解析</h2>
                <Radar size={19} />
              </div>
              {data?.parseResult ? (
                <div className="analysis-stack">
                  <div className="chip-list">
                    {data.parseResult.keywords.length ? data.parseResult.keywords.map((keyword) => <span key={keyword}>{keyword}</span>) : <span>暂无关键词</span>}
                  </div>
                  <ReasonList title="加分原因" items={data.parseResult.positiveReasons} tone="success" />
                  <ReasonList title="扣分/风险" items={[...data.parseResult.negativeReasons, ...data.parseResult.riskSignals]} tone="warning" />
                  <p className="helper-text">
                    截止时间 {data.parseResult.deadline ? toDateInput(data.parseResult.deadline) : "未识别"} · 解析置信度 {data.parseResult.confidence}
                  </p>
                </div>
              ) : (
                <EmptyState title="暂无解析结果" detail="通过数据源导入或岗位解析后，这里会显示关键词、风险和匹配理由。" tone="info" icon={Radar} />
              )}
            </motion.section>

            <motion.section className="panel package-panel" variants={panelIn}>
              <div className="panel-title compact">
                <h2>申请记录</h2>
                <BadgeCheck size={19} />
              </div>
              {applicationDraft ? (
                <div className="package-form">
                  <label>
                    状态
                    <select value={applicationDraft.status} onChange={(event) => setApplicationDraft({ ...applicationDraft, status: event.target.value as ApplicationStatus })}>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    投递日期
                    <input value={applicationDraft.appliedAt ?? ""} onChange={(event) => setApplicationDraft({ ...applicationDraft, appliedAt: event.target.value })} type="date" />
                  </label>
                  <label>
                    回信日期
                    <input value={applicationDraft.responseAt ?? ""} onChange={(event) => setApplicationDraft({ ...applicationDraft, responseAt: event.target.value })} type="date" />
                  </label>
                  <label>
                    下次跟进
                    <input value={applicationDraft.nextActionAt ?? ""} onChange={(event) => setApplicationDraft({ ...applicationDraft, nextActionAt: event.target.value })} type="date" />
                  </label>
                  <label className="full-span">
                    下一步动作
                    <input value={applicationDraft.nextAction ?? ""} onChange={(event) => setApplicationDraft({ ...applicationDraft, nextAction: event.target.value })} />
                  </label>
                  <label className="full-span">
                    备注/复盘
                    <textarea value={applicationDraft.notes ?? ""} onChange={(event) => setApplicationDraft({ ...applicationDraft, notes: event.target.value })} />
                  </label>
                  <button className="fill-button compact-button" disabled={isBusy} onClick={saveApplication} type="button">
                    保存申请记录
                    <Save size={17} />
                  </button>
                </div>
              ) : (
                <div className="empty-state actionable">
                  <strong>还没有申请记录</strong>
                  <span>创建后可以绑定 Edge 表单快照、记录状态和保存投递时间。</span>
                  <button className="secondary-button inline strong" disabled={isBusy} onClick={createApplication} type="button">
                    创建申请记录
                  </button>
                </div>
              )}
            </motion.section>

            <motion.section className="panel package-panel wide" variants={panelIn}>
              <div className="panel-title compact">
                <h2>投递材料</h2>
                <Layers3 size={19} />
              </div>
              <div className="package-action-row">
                <span className="helper-text">推荐简历：{data?.recommendedResume?.name ?? "未配置，使用本地模板兜底"}</span>
                <button className="secondary-button inline strong" disabled={isBusy} onClick={generateMaterials} type="button">
                  生成/刷新材料包
                </button>
              </div>
              {data?.drafts.length ? (
                <div className="material-package-list">
                  {data.drafts.map((draft) => (
                    <article className="package-draft" key={draft.id}>
                      <div className="material-card-meta">
                        <span className="answer-chip accent">{draftTypeLabel(draft.draftType)}</span>
                        <span>{materialStatusLabels[draft.status] ?? draft.status}</span>
                      </div>
                      <input value={draft.title} onChange={(event) => updatePackageDraft(draft.id, { title: event.target.value })} />
                      <textarea value={draft.content} onChange={(event) => updatePackageDraft(draft.id, { content: event.target.value })} />
                      <div className="card-actions">
                        <label className="inline-select-label">
                          状态
                          <select value={draft.status} onChange={(event) => updatePackageDraft(draft.id, { status: event.target.value })}>
                            {Object.entries(materialStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="secondary-button inline" disabled={isBusy} onClick={() => copyPackageDraft(draft)} type="button">
                          复制文本
                        </button>
                        <button className="secondary-button inline strong" disabled={isBusy} onClick={() => savePackageDraft(draft)} type="button">
                          保存草稿
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="暂无材料草稿" detail="点击生成材料包后，会出现 JD 对齐卖点、Cover Letter 和筛选题草稿。" tone="info" icon={Layers3} />
              )}
            </motion.section>

            <motion.section className="panel package-panel wide" variants={panelIn}>
              <div className="panel-title compact">
                <h2>Edge 表单绑定</h2>
                <MousePointerClick size={19} />
              </div>
              <div className="package-metrics">
                <Metric label="安全字段" value={String(safeFieldCount)} />
                <Metric label="待确认字段" value={String(reviewFieldCount)} />
                <Metric label="映射规则" value={String(enabledMappingRules)} />
              </div>
              <div className={data?.edgeContext?.active ? "edge-context-bar active" : "edge-context-bar"}>
                <div>
                  <strong>{data?.edgeContext?.active ? "当前 Edge 申请已绑定" : "Edge 当前申请未设置"}</strong>
                  <span>
                    {data?.edgeContext?.active
                      ? `有效至 ${formatDateTime(data.edgeContext.expiresAt)} · ${data.edgeContext.hostHint || "不限域名"}`
                      : "设置后，扩展保存的表单快照会自动绑定到这个岗位。"}
                  </span>
                </div>
                {data?.application ? (
                  <div className="edge-context-actions">
                    <button className="secondary-button inline strong" disabled={isBusy} onClick={activateEdgeContext} type="button">
                      设为当前 Edge 申请
                    </button>
                    <button className="secondary-button inline" disabled={isBusy || !data.edgeContext?.active} onClick={clearEdgeContext} type="button">
                      清除
                    </button>
                  </div>
                ) : null}
              </div>
              {data?.application ? (
                <div className="snapshot-bind-row">
                  <label>
                    最近表单快照
                    <select value={selectedSnapshotId} onChange={(event) => setSelectedSnapshotId(event.target.value)}>
                      <option value="">选择快照</option>
                      {availableSnapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.title || snapshot.host || snapshot.url} · 安全 {snapshot.safeCount} · 确认 {snapshot.reviewCount}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary-button inline strong" disabled={isBusy || !selectedSnapshotId} onClick={bindSnapshot} type="button">
                    绑定到当前申请
                  </button>
                </div>
              ) : (
                <p className="helper-text">先创建申请记录，再把 Edge 扩展保存的表单快照绑定到这个岗位。</p>
              )}
              <div className="snapshot-card-list">
                {boundSnapshots.length ? (
                  boundSnapshots.map((snapshot) => (
                    <article className="package-snapshot-card" key={snapshot.id}>
                      <strong>{snapshot.title || snapshot.host || "未命名表单"}</strong>
                      <span>{snapshot.atsVendor || "通用表单"} · 字段 {snapshot.fieldCount} · {formatDateTime(snapshot.updatedAt)}</span>
                      <p>{snapshot.url}</p>
                    </article>
                  ))
                ) : (
                  <EmptyState title="暂无绑定快照" detail="在 Edge 扩展中扫描申请表并保存快照后，可以从这里手动绑定。" tone="warning" icon={ShieldCheck} />
                )}
              </div>
              {packageReplaySnapshot ? (
                <SnapshotReplayPanel
                  snapshot={packageReplaySnapshot}
                  profile={profile}
                  mappingRules={mappingRules}
                  title={boundSnapshots.length ? "绑定快照回放" : "待绑定快照预览"}
                  contextTitle={`${currentJob.company} · ${currentJob.title}`}
                  onMessage={setMessage}
                />
              ) : null}
              {data?.recentRuns.length ? (
                <div className="run-strip">
                  {data.recentRuns.map((run) => (
                    <span key={run.id}>
                      {formatDateTime(run.createdAt)} · 填写 {run.fieldsFilled} · 跳过 {run.fieldsSkipped}
                    </span>
                  ))}
                </div>
              ) : null}
            </motion.section>

            <motion.section className="panel package-panel wide" variants={panelIn}>
              <div className="panel-title compact">
                <h2>题库引用</h2>
                <ClipboardList size={19} />
              </div>
              {data?.answers.length ? (
                <div className="answer-reference-list">
                  {data.answers.map((answer) => (
                    <article className="source-card" key={answer.id}>
                      <strong>{answer.question}</strong>
                      <span>{answer.market ? marketLabels[answer.market] : "通用"} · {answer.roleFamily || "通用"}</span>
                      <p>{compactText(answer.answer, 220)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="暂无题库引用" detail="在笔试面试库沉淀答案后，投递包会按市场和方向展示可复用内容。" tone="info" icon={ClipboardList} />
              )}
            </motion.section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ReasonList({ title, items, tone }: { title: string; items: string[]; tone: "success" | "warning" }) {
  return (
    <div className={`reason-list ${tone}`}>
      <strong>{title}</strong>
      {items.length ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>暂无记录</p>
      )}
    </div>
  );
}

function SourcesView({
  sources,
  batches,
  busy,
  onCreateSource,
  onUpdateSource,
  onParseClipboard,
  onImportClipboard,
  onImportCsv,
  onSyncSources,
  onOpenMarkets
}: {
  sources: JobSourceItem[];
  batches: ImportBatch[];
  busy: boolean;
  onCreateSource: (source: typeof defaultSource) => void;
  onUpdateSource: (source: JobSourceItem) => void;
  onParseClipboard: (text: string) => Promise<{ parsed: ParsedJob[]; issues: JobParseIssue[]; errors: number; total: number }>;
  onImportClipboard: (text: string, sourceName: string) => void;
  onImportCsv: (csv: string, sourceName: string) => Promise<CsvImportResult | null>;
  onSyncSources: (sourceId?: string) => Promise<SourceSyncResponse | null>;
  onOpenMarkets: () => void;
}) {
  const [sourceDraft, setSourceDraft] = useState(defaultSource);
  const [sourceDrafts, setSourceDrafts] = useState<Record<string, JobSourceItem>>({});
  const [clipboard, setClipboard] = useState(clipboardTemplate);
  const [sourceName, setSourceName] = useState("剪贴板导入");
  const [csvText, setCsvText] = useState(csvTemplate);
  const [csvSourceName, setCsvSourceName] = useState("CSV 文件导入");
  const [csvFileName, setCsvFileName] = useState("尚未选择 CSV 文件");
  const [csvMessage, setCsvMessage] = useState("可选择平台导出的 CSV 文件，或直接粘贴 CSV 内容后导入。");
  const [syncMessage, setSyncMessage] = useState("配置公司官网、ATS 或邮件提醒 URL 后，可以一键同步公开来源。");
  const [syncResults, setSyncResults] = useState<SourceSyncResult[]>([]);
  const [preview, setPreview] = useState<ParsedJob[]>([]);
  const [previewIssues, setPreviewIssues] = useState<JobParseIssue[]>([]);
  const [previewMessage, setPreviewMessage] = useState("粘贴岗位文本后可以先解析预览，再导入岗位库。");
  const latestBatch = batches[0] ?? null;
  const latestIssues = parseImportIssues(latestBatch?.issuesJson);
  const sourceJobCount = sources.reduce((sum, source) => sum + (source._count?.jobs ?? 0), 0);
  const sourceBatchCount = sources.reduce((sum, source) => sum + (source._count?.importBatches ?? 0), 0);
  const syncableSources = sources.filter((source) => source.enabled && Boolean(source.baseUrl?.trim()) && source.sourceType !== "MANUAL");
  const latestSyncLog = sources.flatMap((source) => source.syncLogs ?? []).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
  const nextImportStep = preview.length
    ? {
        tone: "success",
        title: "预览已准备好，可以导入岗位库",
        detail: `当前识别 ${preview.length} 个岗位，${previewIssues.length} 个片段需要人工修正。导入会按 sourceHash 去重。`
      }
    : latestBatch
      ? {
          tone: latestBatch.errorCount > 0 ? "warning" : "info",
          title: latestBatch.errorCount > 0 ? "最近批次有失败项待修复" : "最近批次已入库",
          detail: `最近批次导入 ${latestBatch.importedCount}、去重 ${latestBatch.dedupedCount}、跳过 ${latestBatch.skippedCount}。下一步建议去市场雷达检查岗位质量。`
        }
      : {
          tone: "neutral",
          title: "先做解析预览",
          detail: "把官网、邮件提醒或平台导出的岗位文本粘贴进来，先看识别质量，再决定是否导入。"
      };

  function editableSource(source: JobSourceItem) {
    return sourceDrafts[source.id] ?? source;
  }

  function updateSourceDraft(source: JobSourceItem, patch: Partial<JobSourceItem>) {
    setSourceDrafts((current) => ({
      ...current,
      [source.id]: { ...editableSource(source), ...patch }
    }));
  }

  function saveSourceDraft(source: JobSourceItem) {
    onUpdateSource(editableSource(source));
  }

  async function readCsvFile(file?: File) {
    if (!file) {
      setCsvFileName("尚未选择 CSV 文件");
      return;
    }

    try {
      const text = await file.text();
      setCsvText(text);
      setCsvFileName(file.name);
      setCsvSourceName(file.name.replace(/\.[^.]+$/, "") || "CSV 文件导入");
      setCsvMessage(`已读取 ${file.name}，共 ${text.split(/\r?\n/).filter(Boolean).length} 行。`);
    } catch {
      setCsvFileName(file.name);
      setCsvMessage("CSV 文件读取失败，请重新选择或直接粘贴内容。");
    }
  }

  async function importCsv() {
    if (!csvText.trim()) {
      setCsvMessage("请先选择 CSV 文件或粘贴 CSV 内容。");
      return;
    }

    setCsvMessage("CSV 正在导入，请稍等。");
    const result = await onImportCsv(csvText, csvSourceName || "CSV 文件导入");

    if (!result) {
      setCsvMessage("CSV 导入未完成，请查看顶部状态提示后重试。");
      return;
    }

    const total = result.batch?.totalCount ?? result.imported + result.deduped + result.skipped;
    setCsvMessage(`导入完成：总数 ${total}，新增 ${result.imported}，去重 ${result.deduped}，跳过 ${result.skipped}。`);
  }

  async function parsePreview() {
    try {
      const result = await onParseClipboard(clipboard);
      setPreview(result.parsed);
      setPreviewIssues(result.issues ?? []);
      setPreviewMessage(`识别 ${result.parsed.length} 条，解析失败 ${result.errors} 条。`);
    } catch (error) {
      setPreview([]);
      setPreviewIssues([]);
      setPreviewMessage(error instanceof Error ? error.message : "解析失败");
    }
  }

  async function syncSources(sourceId?: string) {
    setSyncMessage(sourceId ? "正在同步此公开来源..." : "正在同步启用的公开来源...");
    const result = await onSyncSources(sourceId);

    if (!result) {
      setSyncMessage("公开来源同步未完成，请查看顶部状态提示后重试。");
      return;
    }

    setSyncResults(result.results);
    setSyncMessage(result.message);
  }

  return (
    <div className="view-stack">
      <div className="form-grid">
        <motion.section className="panel form-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>数据源管理</h2>
            <Upload size={19} />
          </div>
          <label>
            名称
            <input value={sourceDraft.name} onChange={(event) => setSourceDraft({ ...sourceDraft, name: event.target.value })} />
          </label>
          <label>
            市场
            <select value={sourceDraft.market} onChange={(event) => setSourceDraft({ ...sourceDraft, market: event.target.value as MarketCode })}>
              {Object.entries(marketLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            类型
            <select value={sourceDraft.sourceType} onChange={(event) => setSourceDraft({ ...sourceDraft, sourceType: event.target.value })}>
              <option value="MANUAL">手动/剪贴板</option>
              <option value="COMPANY_SITE">公司官网</option>
              <option value="EMAIL_ALERT">邮件提醒</option>
              <option value="ATS">ATS/平台导出</option>
            </select>
          </label>
          <label>
            可靠度
            <input min="0" max="100" type="number" value={sourceDraft.reliability} onChange={(event) => setSourceDraft({ ...sourceDraft, reliability: Number(event.target.value) })} />
          </label>
          <label className="full-span">
            链接
            <input value={sourceDraft.baseUrl} onChange={(event) => setSourceDraft({ ...sourceDraft, baseUrl: event.target.value })} />
          </label>
          <button className="fill-button compact-button" disabled={busy} onClick={() => onCreateSource(sourceDraft)} type="button">
            新增数据源
          </button>
        </motion.section>

        <motion.section className="panel form-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>剪贴板/邮件导入</h2>
            <ClipboardList size={19} />
          </div>
          <label className="full-span">
            来源名称
            <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} />
          </label>
          <textarea className="csv-box" value={clipboard} onChange={(event) => setClipboard(event.target.value)} />
          <div className="button-row">
            <button className="secondary-button inline" disabled={busy} onClick={parsePreview} type="button">
              解析预览
            </button>
            <button className="fill-button compact-button" disabled={busy} onClick={() => onImportClipboard(clipboard, sourceName)} type="button">
              导入岗位库
            </button>
          </div>
          <p className="helper-text">{previewMessage}</p>
        </motion.section>

        <motion.section className="panel form-panel csv-file-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>CSV 文件导入</h2>
            <Upload size={19} />
          </div>
          <label className="full-span">
            来源名称
            <input value={csvSourceName} onChange={(event) => setCsvSourceName(event.target.value)} />
          </label>
          <label className="file-picker full-span">
            选择 CSV 文件
            <input accept=".csv,text/csv" type="file" onChange={(event) => readCsvFile(event.target.files?.[0])} />
          </label>
          <div className="csv-file-status full-span">
            <strong>{csvFileName}</strong>
            <span>{csvMessage}</span>
          </div>
          <textarea className="csv-box" value={csvText} onChange={(event) => setCsvText(event.target.value)} />
          <button className="fill-button compact-button" disabled={busy || !csvText.trim()} onClick={importCsv} type="button">
            导入 CSV 岗位
          </button>
          <p className="helper-text">支持表头：市场、公司、岗位、地点、链接、描述、匹配分、发布时间。导入会按市场、公司、岗位和链接去重。</p>
        </motion.section>
      </div>

      <motion.section className="panel source-command-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>导入控制台</h2>
            <p>先看解析质量，再决定是否入库；入库后去市场雷达检查岗位和匹配分。</p>
          </div>
          <Radar size={19} />
        </div>
        <div className="source-command-grid">
          <Metric label="预览岗位" value={String(preview.length)} tone={preview.length ? "success" : undefined} />
          <Metric label="预览失败" value={String(previewIssues.length)} />
          <Metric label="来源岗位" value={String(sourceJobCount)} />
          <Metric label="导入批次" value={String(sourceBatchCount)} />
        </div>
        <div className={`source-next-step ${nextImportStep.tone}`}>
          <div>
            <strong>{nextImportStep.title}</strong>
            <span>{nextImportStep.detail}</span>
          </div>
          <div className="source-next-actions">
            <button className="secondary-button inline" disabled={busy} onClick={parsePreview} type="button">
              重新解析
            </button>
            <button className="secondary-button inline strong" disabled={busy || !preview.length} onClick={() => onImportClipboard(clipboard, sourceName)} type="button">
              导入岗位库
            </button>
            <button className="secondary-button inline" disabled={!latestBatch && !sourceJobCount} onClick={onOpenMarkets} type="button">
              去市场雷达检查
            </button>
          </div>
        </div>
        {latestBatch ? (
          <div className="latest-batch-strip">
            <span>{latestBatch.sourceName}</span>
            <strong>入库 {latestBatch.importedCount}</strong>
            <strong>去重 {latestBatch.dedupedCount}</strong>
            <strong>跳过 {latestBatch.skippedCount}</strong>
            <strong>失败 {latestBatch.errorCount}</strong>
            <em>{formatDateTime(latestBatch.createdAt)}</em>
          </div>
        ) : null}
        {latestIssues.length ? (
          <div className="parse-issue-list compact">
            {latestIssues.map((issue, index) => (
              <article className="parse-issue-card" key={`${issue.reason}-${index}`}>
                <strong>{issue.reason}</strong>
                <span>{issue.sourceUrl || "未识别链接"}</span>
                <p>{compactText(issue.rawText, 120)}</p>
              </article>
            ))}
          </div>
        ) : null}
      </motion.section>

      <motion.section className="panel source-sync-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>公开来源同步</h2>
            <p>只同步你配置的公开 URL，不登录、不绕限制、不自动投递。</p>
          </div>
          <Globe2 size={19} />
        </div>
        <div className="source-sync-grid">
          <Metric label="可同步来源" value={String(syncableSources.length)} tone={syncableSources.length ? "success" : undefined} />
          <Metric label="新增岗位" value={String(syncResults.reduce((sum, item) => sum + item.imported, 0))} tone={syncResults.some((item) => item.imported) ? "success" : undefined} />
          <Metric label="去重岗位" value={String(syncResults.reduce((sum, item) => sum + item.deduped, 0))} />
          <Metric label="同步失败" value={String(syncResults.reduce((sum, item) => sum + item.errors, 0))} tone={syncResults.some((item) => item.errors) ? "warning" : undefined} />
        </div>
        <div className="source-sync-actions">
          <span>{syncMessage}</span>
          <button className="secondary-button inline strong" disabled={busy || !syncableSources.length} onClick={() => syncSources()} type="button">
            同步启用公开来源
          </button>
        </div>
        {latestSyncLog ? (
          <div className="latest-sync-log">
            <strong>最近同步</strong>
            <span>{latestSyncLog.status} · {latestSyncLog.message || "无说明"} · {formatDateTime(latestSyncLog.createdAt)}</span>
          </div>
        ) : null}
        {syncResults.length ? (
          <div className="source-sync-result-list">
            {syncResults.map((result) => (
              <article className={`source-sync-result ${result.status}`} key={result.sourceId}>
                <strong>{result.sourceName}</strong>
                <span>{result.message}</span>
                <p>抽取 {result.extractedChars} 字 · 总数 {result.total} · 新增 {result.imported} · 去重 {result.deduped} · 失败 {result.errors}</p>
              </article>
            ))}
          </div>
        ) : null}
      </motion.section>

      <div className="middle-grid">
        <motion.section className="panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>解析预览</h2>
            <Radar size={19} />
          </div>
          {preview.length ? (
            <div className="job-grid compact">
              {preview.map((job) => (
                <article className="market-card job-card" key={`${job.company}-${job.title}`}>
                  <span className={`status-dot ${toneFromScore(job.matchScore)}`} />
                  <strong>{job.title}</strong>
                  <p>{job.company} · {marketLabels[job.market]} · {job.location || "地点待确认"}</p>
                  <span className="job-meta">签证风险 {job.visaRisk} · 毕业生匹配 {job.graduateFit}</span>
                  <em className={toneFromScore(job.matchScore)}>{job.matchScore}</em>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无解析预览" detail="点击解析预览后，这里会展示自动识别出的岗位。" tone="info" icon={Upload} />
          )}
          {previewIssues.length ? (
            <div className="parse-issue-list">
              {previewIssues.slice(0, 4).map((issue, index) => (
                <article className="parse-issue-card" key={`${issue.reason}-${index}`}>
                  <strong>{issue.reason}</strong>
                  <span>{issue.sourceUrl || "未识别链接"}</span>
                  <p>{compactText(issue.rawText, 140)}</p>
                </article>
              ))}
            </div>
          ) : null}
        </motion.section>

        <motion.section className="panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>数据源列表</h2>
            <Archive size={19} />
          </div>
          <div className="source-list">
            {sources.map((source) => {
              const draft = editableSource(source);
              return (
                <article className="source-card source-editor-card" key={source.id}>
                  <div className="material-card-meta">
                    <span className={draft.enabled ? "answer-chip accent" : "answer-chip"}>{draft.enabled ? "已启用" : "已暂停"}</span>
                    <span>岗位 {source._count?.jobs ?? 0} · 批次 {source._count?.importBatches ?? 0}</span>
                    {source.lastSyncedAt ? <span>同步 {formatDateTime(source.lastSyncedAt)}</span> : null}
                  </div>
                  <label>
                    名称
                    <input value={draft.name} onChange={(event) => updateSourceDraft(source, { name: event.target.value })} />
                  </label>
                  <label>
                    市场
                    <select value={draft.market} onChange={(event) => updateSourceDraft(source, { market: event.target.value as MarketCode })}>
                      {Object.entries(marketLabels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    类型
                    <select value={draft.sourceType} onChange={(event) => updateSourceDraft(source, { sourceType: event.target.value as SourceTypeCode })}>
                      <option value="MANUAL">手动/剪贴板</option>
                      <option value="COMPANY_SITE">公司官网</option>
                      <option value="EMAIL_ALERT">邮件提醒</option>
                      <option value="ATS">ATS/平台导出</option>
                      <option value="ADZUNA">公开 API</option>
                    </select>
                  </label>
                  <label>
                    可靠度
                    <input min="0" max="100" type="number" value={draft.reliability} onChange={(event) => updateSourceDraft(source, { reliability: Number(event.target.value) })} />
                  </label>
                  <label className="full-span">
                    链接
                    <input value={draft.baseUrl ?? ""} onChange={(event) => updateSourceDraft(source, { baseUrl: event.target.value })} />
                  </label>
                  <label className="checkbox-row compact">
                    <input checked={draft.enabled} onChange={(event) => updateSourceDraft(source, { enabled: event.target.checked })} type="checkbox" />
                    启用此数据源
                  </label>
                  <button className="secondary-button inline strong" disabled={busy || !draft.name.trim()} onClick={() => saveSourceDraft(source)} type="button">
                    保存数据源
                  </button>
                  <button className="secondary-button inline" disabled={busy || !draft.baseUrl?.trim()} onClick={() => syncSources(source.id)} type="button">
                    同步此来源
                  </button>
                </article>
              );
            })}
          </div>
        </motion.section>
      </div>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>最近导入批次</h2>
          <BadgeCheck size={19} />
        </div>
        {batches.length ? (
          <div className="batch-grid">
            {batches.map((batch) => {
              const issues = parseImportIssues(batch.issuesJson);
              const hasIssue = batch.errorCount > 0 || issues.length > 0;
              return (
                <article className={hasIssue ? "pipeline-tile batch-tile warning" : "pipeline-tile batch-tile"} key={batch.id}>
                  <strong>{batch.importedCount}</strong>
                  <span>{batch.sourceName}</span>
                  <p>{formatDateTime(batch.createdAt)} · 总数 {batch.totalCount} · 去重 {batch.dedupedCount} · 跳过 {batch.skippedCount} · 失败 {batch.errorCount}</p>
                  {issues.length ? <p className="batch-warning">待修复：{issues.map((issue) => issue.reason).join(" / ")}</p> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="暂无导入批次" detail="从剪贴板或 CSV 导入岗位后，这里会显示批次统计。" tone="info" icon={Upload} />
        )}
      </motion.section>
    </div>
  );
}

function SnapshotReplayPanel({
  snapshot,
  profile,
  mappingRules,
  title = "表单回放清单",
  contextTitle,
  onMessage
}: {
  snapshot: FormSnapshot;
  profile?: Profile | null;
  mappingRules: FieldMappingRule[];
  title?: string;
  contextTitle?: string;
  onMessage?: (message: string) => void;
}) {
  const replay = buildSnapshotReplay(snapshot, profile, mappingRules);
  const previewGroups = [
    { key: "ready", label: "可直接填写", detail: "安全字段且资料库已有值", items: replay.ready, tone: "success" as const },
    { key: "review", label: "待人工确认", detail: "合规、薪资、签证或敏感相关字段", items: replay.review, tone: "warning" as const },
    { key: "missing", label: "缺映射/缺值", detail: "先补资料或保存映射规则", items: replay.missing, tone: "info" as const }
  ];

  async function copyReplay() {
    const markdown = buildSnapshotReplayMarkdown({ snapshot, profile, mappingRules, contextTitle });

    try {
      await navigator.clipboard.writeText(markdown);
      onMessage?.("表单回放清单已复制。");
    } catch {
      onMessage?.("复制失败，可以下载回放 Markdown 后查看。");
    }
  }

  function downloadReplay() {
    const markdown = buildSnapshotReplayMarkdown({ snapshot, profile, mappingRules, contextTitle });
    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-${snapshot.atsVendor || "通用表单"}-${snapshot.host || "表单"}-回放清单`)}.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    onMessage?.(`已下载 ${filename}。`);
  }

  return (
    <div className="snapshot-replay-panel">
      <div className="snapshot-replay-head">
        <div>
          <span>Edge 实战回放</span>
          <strong>{title}</strong>
          <p>{snapshot.title || snapshot.host || "未命名表单"} · {snapshot.atsVendor || "通用表单"} · {formatDateTime(snapshot.updatedAt)}</p>
        </div>
        <div className="snapshot-replay-actions">
          <button className="secondary-button inline strong" onClick={copyReplay} type="button">
            复制回放清单
          </button>
          <button className="secondary-button inline" onClick={downloadReplay} type="button">
            下载回放.md
          </button>
        </div>
      </div>

      <div className="snapshot-replay-metrics">
        <Metric label="可直接填写" value={String(replay.ready.length)} tone={replay.ready.length ? "success" : undefined} />
        <Metric label="待人工确认" value={String(replay.review.length)} tone={replay.review.length ? "warning" : undefined} />
        <Metric label="缺映射/缺值" value={String(replay.missing.length)} tone={replay.missing.length ? "warning" : undefined} />
        <Metric label="已保存规则" value={String(replay.savedRules)} tone={replay.savedRules ? "success" : undefined} />
      </div>

      <div className="snapshot-replay-groups">
        {previewGroups.map((group) => (
          <article className={`snapshot-replay-group ${group.key}`} key={group.key}>
            <div>
              <strong>{group.label}</strong>
              <span>{group.detail}</span>
            </div>
            {group.items.length ? (
              <ul>
                {group.items.slice(0, 5).map((item) => (
                  <li key={item.field.id}>
                    <span>{item.field.label || item.field.inputName || "未命名字段"}</span>
                    <em>
                      {item.profileField?.label || item.candidateKey || "未映射"} · {item.hasSavedRule ? "已保存规则" : item.reason}
                    </em>
                  </li>
                ))}
              </ul>
            ) : (
              <p>暂无字段</p>
            )}
          </article>
        ))}
      </div>
      <p className="snapshot-replay-boundary">回放清单只用于本地核对；最终提交、验证码、文件上传和敏感字段仍由你人工处理。</p>
    </div>
  );
}

function MaterialsView({
  jobs,
  resumes,
  materials,
  busy,
  onCreateResume,
  onUpdateResume,
  onGenerateMaterials,
  onUpdateMaterial,
  onLocalChange
}: {
  jobs: Job[];
  resumes: ResumeVersion[];
  materials: MaterialDraft[];
  busy: boolean;
  onCreateResume: (resume: typeof defaultResume) => void;
  onUpdateResume: (resume: ResumeVersion) => void;
  onGenerateMaterials: (jobId: string, resumeVersionId?: string) => void;
  onUpdateMaterial: (draft: MaterialDraft) => void;
  onLocalChange: (drafts: MaterialDraft[]) => void;
}) {
  const [resumeDraft, setResumeDraft] = useState(defaultResume);
  const [resumeDrafts, setResumeDrafts] = useState<Record<string, ResumeVersion>>({});
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id ?? "");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [materialJobFilter, setMaterialJobFilter] = useState("ALL");
  const [materialTypeFilter, setMaterialTypeFilter] = useState("ALL");
  const [materialMessage, setMaterialMessage] = useState("筛选草稿后可以直接编辑、复制或保存。");
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? jobs[0];
  const draftTypes = Array.from(new Set(materials.map((draft) => draft.draftType)));
  const selectedJobMaterials = selectedJob ? materials.filter((draft) => draft.jobId === selectedJob.id) : [];
  const selectedJobDraftTypes = new Set(selectedJobMaterials.map((draft) => draft.draftType));
  const selectedJobReadiness = selectedJob ? Math.min(100, Math.round((selectedJobDraftTypes.size / 3) * 100)) : 0;
  const visibleMaterials = materials.filter((draft) => {
    const matchesJob = materialJobFilter === "ALL" || draft.jobId === materialJobFilter;
    const matchesType = materialTypeFilter === "ALL" || draft.draftType === materialTypeFilter;
    return matchesJob && matchesType;
  });

  function updateDraft(id: string, patch: Partial<MaterialDraft>) {
    onLocalChange(materials.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  function editableResume(resume: ResumeVersion) {
    return resumeDrafts[resume.id] ?? resume;
  }

  function updateResumeDraft(resume: ResumeVersion, patch: Partial<ResumeVersion>) {
    setResumeDrafts((current) => ({
      ...current,
      [resume.id]: { ...editableResume(resume), ...patch }
    }));
  }

  function saveResumeDraft(resume: ResumeVersion) {
    const draft = editableResume(resume);
    onUpdateResume(draft);
    setMaterialMessage(`简历版本已提交保存：${draft.name}`);
  }

  async function copyDraft(draft: MaterialDraft) {
    try {
      await navigator.clipboard.writeText(`${draft.title}\n\n${draft.content}`);
      setMaterialMessage(`已复制：${draft.title}`);
    } catch {
      setMaterialMessage("复制失败，可以直接选中文本手动复制。");
    }
  }

  return (
    <div className="view-stack">
      <div className="form-grid">
        <motion.section className="panel form-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>生成岗位材料包</h2>
            <Layers3 size={19} />
          </div>
          <label className="full-span">
            目标岗位
            <select value={selectedJob?.id ?? ""} onChange={(event) => setSelectedJobId(event.target.value)}>
              <option value="">选择岗位</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} · {job.title}
                </option>
              ))}
            </select>
          </label>
          <label className="full-span">
            简历版本
            <select value={selectedResumeId} onChange={(event) => setSelectedResumeId(event.target.value)}>
              <option value="">自动选择默认版本</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.name}
                </option>
              ))}
            </select>
          </label>
          <button className="fill-button compact-button" disabled={busy || !selectedJob} onClick={() => selectedJob && onGenerateMaterials(selectedJob.id, selectedResumeId || undefined)} type="button">
            生成材料包
          </button>
          <p className="helper-text">当前只用本地模板生成草稿，不会调用外部 AI，也不会上传简历。</p>
        </motion.section>

        <motion.section className="panel form-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>新增简历版本</h2>
            <FileText size={19} />
          </div>
          <label>
            名称
            <input value={resumeDraft.name} onChange={(event) => setResumeDraft({ ...resumeDraft, name: event.target.value })} />
          </label>
          <label>
            市场
            <select value={resumeDraft.market} onChange={(event) => setResumeDraft({ ...resumeDraft, market: event.target.value as MarketCode })}>
              {Object.entries(marketLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            方向
            <input value={resumeDraft.roleFamily} onChange={(event) => setResumeDraft({ ...resumeDraft, roleFamily: event.target.value })} />
          </label>
          <label>
            语言
            <input value={resumeDraft.language} onChange={(event) => setResumeDraft({ ...resumeDraft, language: event.target.value })} />
          </label>
          <label className="full-span">
            内容摘要
            <textarea value={resumeDraft.content} onChange={(event) => setResumeDraft({ ...resumeDraft, content: event.target.value })} />
          </label>
          <button className="fill-button compact-button" disabled={busy} onClick={() => onCreateResume(resumeDraft)} type="button">
            保存简历版本
          </button>
        </motion.section>
      </div>

      <motion.section className="panel material-command-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>材料整理台</h2>
            <p>{materialMessage}</p>
          </div>
          <Layers3 size={19} />
        </div>
        <div className="material-command-grid">
          <Metric label="草稿总数" value={`${materials.length}`} />
          <Metric label="当前岗位材料" value={`${selectedJobMaterials.length}`} />
          <Metric label="当前岗位完整度" value={`${selectedJobReadiness}%`} tone={selectedJobReadiness >= 100 ? "success" : undefined} />
        </div>
        <div className="material-filter-bar">
          <label>
            岗位筛选
            <select value={materialJobFilter} onChange={(event) => setMaterialJobFilter(event.target.value)}>
              <option value="ALL">全部岗位</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} · {job.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            草稿类型
            <select value={materialTypeFilter} onChange={(event) => setMaterialTypeFilter(event.target.value)}>
              <option value="ALL">全部类型</option>
              {draftTypes.map((type) => (
                <option key={type} value={type}>
                  {draftTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <span className="filter-count">显示 {visibleMaterials.length} / {materials.length} 份草稿</span>
        </div>
      </motion.section>

      <div className="middle-grid">
        <motion.section className="panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>简历版本库</h2>
            <Archive size={19} />
          </div>
          <div className="source-list">
            {resumes.map((resume) => {
              const draft = editableResume(resume);
              return (
                <article className="source-card resume-editor-card" key={resume.id}>
                  <div className="material-card-meta">
                    <span className="answer-chip accent">{draft.market ? marketLabels[draft.market] : "通用"}</span>
                    <span>{draft.isDefault ? "默认版本" : "普通版本"}</span>
                  </div>
                  <label>
                    名称
                    <input value={draft.name} onChange={(event) => updateResumeDraft(resume, { name: event.target.value })} />
                  </label>
                  <label>
                    市场
                    <select value={draft.market ?? ""} onChange={(event) => updateResumeDraft(resume, { market: event.target.value ? (event.target.value as MarketCode) : null })}>
                      <option value="">通用</option>
                      {Object.entries(marketLabels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    方向
                    <input value={draft.roleFamily} onChange={(event) => updateResumeDraft(resume, { roleFamily: event.target.value })} />
                  </label>
                  <label>
                    语言
                    <input value={draft.language} onChange={(event) => updateResumeDraft(resume, { language: event.target.value })} />
                  </label>
                  <label className="checkbox-row compact">
                    <input checked={draft.isDefault} onChange={(event) => updateResumeDraft(resume, { isDefault: event.target.checked })} type="checkbox" />
                    设为该市场默认版本
                  </label>
                  <label className="full-span">
                    内容摘要
                    <textarea value={draft.content} onChange={(event) => updateResumeDraft(resume, { content: event.target.value })} />
                  </label>
                  <button className="secondary-button inline strong" disabled={busy || !draft.name.trim() || !draft.content.trim()} onClick={() => saveResumeDraft(resume)} type="button">
                    保存简历版本
                  </button>
                </article>
              );
            })}
          </div>
        </motion.section>

        <motion.section className="panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>材料草稿</h2>
            <ClipboardList size={19} />
          </div>
          {materials.length ? (
            <div className="material-list">
              {visibleMaterials.map((draft) => (
                <article className="material-card" key={draft.id}>
                  <div className="material-card-meta">
                    <span className="answer-chip accent">{draftTypeLabel(draft.draftType)}</span>
                    <span>{draft.job.company} · {draft.job.title}</span>
                  </div>
                  <input value={draft.title} onChange={(event) => updateDraft(draft.id, { title: event.target.value })} />
                  <textarea value={draft.content} onChange={(event) => updateDraft(draft.id, { content: event.target.value })} />
                  <div className="card-actions">
                    <span className="answer-chip">{draft.status === "draft" ? "草稿" : draft.status}</span>
                    <button className="secondary-button inline" disabled={busy} onClick={() => copyDraft(draft)} type="button">
                      复制文本
                    </button>
                    <button className="secondary-button inline" disabled={busy} onClick={() => onUpdateMaterial(draft)} type="button">
                      保存草稿
                    </button>
                  </div>
                </article>
              ))}
              {!visibleMaterials.length ? (
                <EmptyState title="没有符合筛选的草稿" detail="切换岗位或草稿类型筛选，或者先为目标岗位生成材料包。" tone="warning" icon={Layers3} />
              ) : null}
            </div>
          ) : (
            <EmptyState title="暂无材料草稿" detail="选择一个岗位生成材料包后，这里会显示可编辑草稿。" tone="info" icon={Layers3} />
          )}
        </motion.section>
      </div>
    </div>
  );
}

function AutofillView({
  profile,
  metrics,
  snapshots,
  mappingRules,
  runs,
  busy,
  onChangeProfile,
  onSaveProfile,
  onCreateMappingRule,
  onCreateMappingRules,
  onUpdateMappingRule
}: {
  profile: Profile | null;
  metrics: { safeFields: number; reviewFields: number };
  snapshots: FormSnapshot[];
  mappingRules: FieldMappingRule[];
  runs: AutofillRun[];
  busy: boolean;
  onChangeProfile: (profile: Profile) => void;
  onSaveProfile: () => void;
  onCreateMappingRule: (payload: {
    formFieldId?: string;
    host?: string | null;
    atsVendor?: string | null;
    fieldFingerprint?: string;
    labelPattern?: string;
    inputName?: string | null;
    candidateKey: string;
    sensitivity?: Sensitivity;
    source?: string;
  }) => Promise<void>;
  onCreateMappingRules: (payloads: Array<{
    formFieldId?: string;
    host?: string | null;
    atsVendor?: string | null;
    fieldFingerprint?: string;
    labelPattern?: string;
    inputName?: string | null;
    candidateKey: string;
    sensitivity?: Sensitivity;
    source?: string;
  }>) => Promise<void>;
  onUpdateMappingRule: (payload: {
    id: string;
    candidateKey?: string;
    sensitivity?: Sensitivity;
    confidence?: number;
    enabled?: boolean;
  }) => Promise<void>;
}) {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string>>({});
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, Pick<FieldMappingRule, "candidateKey" | "sensitivity" | "confidence" | "enabled">>>({});
  const [profileMessage, setProfileMessage] = useState("先补齐字段框架，再填写真实信息；敏感字段只做人工提醒。");
  const [profilePackMarket, setProfilePackMarket] = useState<ProfilePackMarket>("ALL");

  if (!profile) {
    return <EmptyState title="资料库正在初始化" detail="本地数据库会自动创建默认资料。" tone="info" icon={LoaderCircle} />;
  }

  const currentProfile = profile;
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshots[0] ?? null;
  const latestRun = runs[0];
  const findProfileField = (key: string) => currentProfile.fields.find((field) => field.key === key && field.value.trim()) ?? currentProfile.fields.find((field) => field.key === key);
  const profileCoverageGroups = profileCompletionGroups.map((group) => {
    const items = group.keys.map((key) => {
      const field = findProfileField(key);
      const template = profileTemplateMap.get(key);
      const ready = Boolean(field) && (template?.sensitivity === "sensitive" || Boolean(field?.value.trim()));

      return {
        key,
        label: template?.label ?? key,
        ready,
        exists: Boolean(field),
        sensitivity: template?.sensitivity ?? "review"
      };
    });

    return {
      ...group,
      items,
      readyCount: items.filter((item) => item.ready).length
    };
  });
  const profileCoverageTotal = profileCoverageGroups.reduce((sum, group) => sum + group.items.length, 0);
  const profileCoverageReady = profileCoverageGroups.reduce((sum, group) => sum + group.readyCount, 0);
  const profileCoveragePercent = profileCoverageTotal ? Math.round((profileCoverageReady / profileCoverageTotal) * 100) : 0;
  const missingProfileTemplates = apacProfileTemplates.filter((template) => !currentProfile.fields.some((field) => field.key === template.key));
  const pendingProfileItems = profileCoverageGroups.flatMap((group) => group.items.filter((item) => !item.ready).map((item) => ({ ...item, groupLabel: group.label })));
  const profilePackFields = currentProfile.fields
    .filter((field) => field.value.trim() || field.sensitivity === "sensitive")
    .filter((field) => profilePackMarket === "ALL" || !field.market || field.market === "GLOBAL" || field.market === profilePackMarket)
    .sort((left, right) => {
      const sensitivityOrder: Record<Sensitivity, number> = { safe: 0, review: 1, sensitive: 2 };
      return sensitivityOrder[left.sensitivity] - sensitivityOrder[right.sensitivity] || left.label.localeCompare(right.label, "zh-Hans-CN");
    });
  const profilePackSafeFields = profilePackFields.filter((field) => field.sensitivity === "safe" && field.value.trim());
  const profilePackReviewFields = profilePackFields.filter((field) => field.sensitivity === "review" && field.value.trim());
  const profilePackSensitiveFields = profilePackFields.filter((field) => field.sensitivity === "sensitive");
  const ruleExistsForField = (field: FormSnapshotField, candidateKey: string) =>
    mappingRules.some((rule) => {
      if (rule.candidateKey !== candidateKey) return false;
      if (rule.formFieldId && rule.formFieldId === field.id) return true;
      if (rule.fieldFingerprint && rule.fieldFingerprint === field.fieldFingerprint) return true;
      if (rule.inputName && field.inputName && normalizeSearchText(rule.inputName) === normalizeSearchText(field.inputName)) return true;
      const ruleLabel = normalizeSearchText(rule.labelPattern || "");
      const fieldLabel = normalizeSearchText(field.label || "");
      return Boolean(ruleLabel && fieldLabel && (fieldLabel.includes(ruleLabel) || ruleLabel.includes(fieldLabel.slice(0, 80))));
    });
  const mappingCandidates = (selectedSnapshot?.fields ?? []).map((field) => {
    const candidateKey = mappingDrafts[field.id] || field.mappedKey || field.detectedKey || "";
    const profileField = candidateKey ? findProfileField(candidateKey) : undefined;
    const isSensitive = field.sensitivity === "sensitive" || profileField?.sensitivity === "sensitive";
    const hasSavedRule = Boolean(candidateKey && ruleExistsForField(field, candidateKey));
    const hasValue = Boolean(profileField?.value.trim());
    const learnable = Boolean(candidateKey && profileField && !isSensitive && !hasSavedRule);

    return {
      field,
      candidateKey,
      profileField,
      hasValue,
      hasSavedRule,
      learnable,
      safeToBatch: learnable && field.sensitivity === "safe" && profileField?.sensitivity === "safe" && hasValue
    };
  });
  const mappingLearnableCount = mappingCandidates.filter((item) => item.learnable).length;
  const mappingSavedCount = mappingCandidates.filter((item) => item.hasSavedRule).length;
  const mappingMissingValueCount = mappingCandidates.filter((item) => item.learnable && !item.hasValue).length;
  const safeBatchCandidates = mappingCandidates.filter((item) => item.safeToBatch).slice(0, 40);

  function updateField(index: number, patch: Partial<ProfileField>) {
    const fields = currentProfile.fields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field));
    onChangeProfile({ ...currentProfile, fields });
  }

  function addMissingProfileTemplates() {
    if (!missingProfileTemplates.length) {
      setProfileMessage("APAC 常见字段框架已完整，下一步补真实值并保存资料库。");
      return;
    }

    onChangeProfile({
      ...currentProfile,
      fields: [...currentProfile.fields, ...missingProfileTemplates.map((field) => ({ ...field }))]
    });
    setProfileMessage(`已新增 ${missingProfileTemplates.length} 个字段框架，请补充真实值后保存资料库。`);
  }

  async function copyProfileGaps() {
    const lines = [
      `${currentProfile.name} · 填表资料库缺口`,
      `完整度：${profileCoverageReady}/${profileCoverageTotal}，${profileCoveragePercent}%`,
      "",
      ...(pendingProfileItems.length
        ? pendingProfileItems.map((item) => `- ${item.groupLabel} / ${item.label}：${item.exists ? "待填写" : item.sensitivity === "sensitive" ? "建议建字段即可，不建议保存证件原文" : "字段未建立"}`)
        : ["- 常见字段已完整。"]),
      "",
      "边界：安全字段可由 Edge 辅助填写；薪资、签证、工作权利、证件信息仍需人工确认。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setProfileMessage("资料缺口清单已复制。");
    } catch {
      setProfileMessage("复制失败，可以按完整度面板逐项补齐。");
    }
  }

  function buildProfilePackMarkdown(mode: "safe" | "review" | "full") {
    const marketLabel = profilePackMarketLabels[profilePackMarket];
    const includeSafe = mode === "safe" || mode === "full";
    const includeReview = mode === "review" || mode === "full";
    const lines = [
      `# ${currentProfile.name} · ${marketLabel} 填表速查包`,
      "",
      `生成时间：${new Date().toLocaleString("zh-CN")}`,
      `说明：${currentProfile.headline || "本地求职资料库"}`,
      "",
      "## 安全可填字段",
      ...(includeSafe && profilePackSafeFields.length
        ? profilePackSafeFields.map((field) => `- ${field.label}（${field.key}）：${field.value}`)
        : ["- 本次未导出安全字段。"]),
      "",
      "## 人工确认字段",
      ...(includeReview && profilePackReviewFields.length
        ? profilePackReviewFields.map((field) => `- ${field.label}（${field.key}）：${field.value}`)
        : ["- 本次未导出人工确认字段。"]),
      "",
      "## 敏感字段提醒",
      ...(profilePackSensitiveFields.length
        ? profilePackSensitiveFields.map((field) => `- ${field.label}（${field.key}）：不导出字段值，真实表单中人工确认。`)
        : ["- 当前市场没有敏感字段提醒。"]),
      "",
      "## 操作边界",
      "- 这份速查包只用于人工核对和复制，不代表已经提交申请。",
      "- 签证、工作权利、薪资、国籍、出生日期、证件号码等字段必须按真实情况人工确认。",
      "- Edge 扩展仍只辅助填写安全字段，不自动提交、不绕验证码、不自动上传文件。"
    ];

    return lines.join("\n");
  }

  async function copyProfilePack(mode: "safe" | "review" | "full") {
    const markdown = buildProfilePackMarkdown(mode);

    try {
      await navigator.clipboard.writeText(markdown);
      setProfileMessage(mode === "safe" ? "安全字段速查包已复制。" : mode === "review" ? "人工确认字段速查包已复制。" : "完整填表速查包已复制。");
    } catch {
      setProfileMessage("复制失败，可以下载速查包 Markdown 后打开查看。");
    }
  }

  function downloadProfilePack() {
    const markdown = buildProfilePackMarkdown("full");
    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-${profilePackMarketLabels[profilePackMarket]}-填表速查包`)}.md`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setProfileMessage(`已下载 ${filename}。`);
  }

  async function saveMappingRule(field: FormSnapshotField) {
    const candidateKey = mappingDrafts[field.id] || field.mappedKey || field.detectedKey || "";
    if (!candidateKey || !selectedSnapshot) return;

    await onCreateMappingRule({
      formFieldId: field.id,
      host: selectedSnapshot.host,
      atsVendor: selectedSnapshot.atsVendor,
      fieldFingerprint: field.fieldFingerprint,
      labelPattern: field.label,
      inputName: field.inputName,
      candidateKey,
      sensitivity: field.sensitivity === "sensitive" ? "review" : field.sensitivity,
      source: "manual"
    });
  }

  async function saveSafeMappingSuggestions() {
    if (!selectedSnapshot || !safeBatchCandidates.length) return;

    await onCreateMappingRules(
      safeBatchCandidates.map((item) => ({
        formFieldId: item.field.id,
        host: selectedSnapshot.host,
        atsVendor: selectedSnapshot.atsVendor,
        fieldFingerprint: item.field.fieldFingerprint,
        labelPattern: item.field.label,
        inputName: item.field.inputName,
        candidateKey: item.candidateKey,
        sensitivity: "safe",
        source: "batch_suggestion"
      }))
    );
    setProfileMessage(`已提交 ${safeBatchCandidates.length} 条安全字段建议，刷新后 Edge 会优先使用这些规则。`);
  }

  function getRuleDraft(rule: FieldMappingRule) {
    return ruleDrafts[rule.id] ?? {
      candidateKey: rule.candidateKey,
      sensitivity: rule.sensitivity,
      confidence: rule.confidence,
      enabled: rule.enabled
    };
  }

  function updateRuleDraft(rule: FieldMappingRule, patch: Partial<Pick<FieldMappingRule, "candidateKey" | "sensitivity" | "confidence" | "enabled">>) {
    setRuleDrafts({
      ...ruleDrafts,
      [rule.id]: {
        ...getRuleDraft(rule),
        ...patch
      }
    });
  }

  function saveRuleDraft(rule: FieldMappingRule) {
    onUpdateMappingRule({
      id: rule.id,
      ...getRuleDraft(rule)
    });
  }

  return (
    <div className="view-stack">
      <div className="top-grid">
        <motion.section className="panel autofill-panel" variants={panelIn}>
          <div className="panel-title">
            <div>
              <h2>Edge 自动填表助手</h2>
              <p>扩展会从本地 API 读取这些字段，不会自动提交申请。</p>
            </div>
            <MousePointerClick size={20} />
          </div>
          <div className="autofill-metrics">
            <Metric label="总字段" value={String(profile.fields.length)} />
            <Metric label="可自动填" value={String(metrics.safeFields)} tone="success" />
            <Metric label="待确认" value={String(metrics.reviewFields)} />
          </div>
          <button className="fill-button" disabled={busy} onClick={onSaveProfile} type="button">
            <Save size={18} />
            保存资料库
          </button>
        </motion.section>

        <motion.section className="panel wide-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>自动填表安全规则</h2>
            <ShieldCheck size={19} />
          </div>
          <div className="rule-list">
            <RuleItem label="会自动填写" value="姓名、邮箱、电话、学校、链接等低风险字段" />
            <RuleItem label="需要确认" value="签证、工作权利、薪资期望、是否接受调剂" />
            <RuleItem label="永不处理" value="最终提交、验证码、密码、身份伪造信息" />
          </div>
        </motion.section>
      </div>

      <motion.section className="panel profile-readiness-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>资料库完整度</h2>
            <p>{profileCoverageReady} / {profileCoverageTotal} 项已就绪，优先补齐高频字段再去真实表单里测试。</p>
          </div>
          <strong>{profileCoveragePercent}%</strong>
        </div>
        <div className="progress-track">
          <span className="progress-fill success" style={{ width: `${profileCoveragePercent}%` }} />
        </div>
        <div className="profile-readiness-actions">
          <span className="helper-text">{profileMessage}</span>
          <div>
            <button className="secondary-button inline strong" disabled={busy || !missingProfileTemplates.length} onClick={addMissingProfileTemplates} type="button">
              补齐常见字段
            </button>
            <button className="secondary-button inline" disabled={busy} onClick={copyProfileGaps} type="button">
              复制缺口清单
            </button>
          </div>
        </div>
        <div className="profile-completion-grid">
          {profileCoverageGroups.map((group) => {
            const pendingItems = group.items.filter((item) => !item.ready);

            return (
              <article className={group.readyCount === group.items.length ? "profile-completion-card done" : "profile-completion-card"} key={group.key}>
                <span>{group.readyCount} / {group.items.length}</span>
                <strong>{group.label}</strong>
                <p>{group.detail}</p>
                <div className="profile-gap-list">
                  {pendingItems.length ? pendingItems.slice(0, 4).map((item) => <em key={item.key}>{item.label}</em>) : <em>已就绪</em>}
                </div>
              </article>
            );
          })}
        </div>
      </motion.section>

      <motion.section className="panel profile-pack-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>填表速查包</h2>
            <p>当官网字段需要人工粘贴或 Edge 无法处理时，按市场导出一份可复制的资料清单。</p>
          </div>
          <FileText size={19} />
        </div>
        <div className="profile-pack-toolbar">
          <label>
            目标市场
            <select value={profilePackMarket} onChange={(event) => setProfilePackMarket(event.target.value as ProfilePackMarket)}>
              {Object.entries(profilePackMarketLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="profile-pack-metrics">
            <Metric label="安全字段" value={String(profilePackSafeFields.length)} tone="success" />
            <Metric label="待确认" value={String(profilePackReviewFields.length)} />
            <Metric label="敏感提醒" value={String(profilePackSensitiveFields.length)} />
          </div>
          <div className="profile-pack-actions">
            <button className="secondary-button inline strong" disabled={busy || !profilePackSafeFields.length} onClick={() => copyProfilePack("safe")} type="button">
              复制安全字段
            </button>
            <button className="secondary-button inline" disabled={busy || !profilePackReviewFields.length} onClick={() => copyProfilePack("review")} type="button">
              复制待确认字段
            </button>
            <button className="secondary-button inline" disabled={busy} onClick={() => copyProfilePack("full")} type="button">
              复制完整速查包
            </button>
            <button className="secondary-button inline" disabled={busy} onClick={downloadProfilePack} type="button">
              下载速查.md
            </button>
          </div>
        </div>
        <div className="profile-pack-preview">
          <div>
            <span>安全可填</span>
            {profilePackSafeFields.length ? profilePackSafeFields.slice(0, 6).map((field) => <strong key={`${field.key}-${field.market ?? "GLOBAL"}`}>{field.label}</strong>) : <em>暂无可导出字段</em>}
          </div>
          <div>
            <span>人工确认</span>
            {profilePackReviewFields.length ? profilePackReviewFields.slice(0, 6).map((field) => <strong key={`${field.key}-${field.market ?? "GLOBAL"}`}>{field.label}</strong>) : <em>暂无待确认字段</em>}
          </div>
          <div>
            <span>敏感不导值</span>
            {profilePackSensitiveFields.length ? profilePackSensitiveFields.slice(0, 6).map((field) => <strong key={`${field.key}-${field.market ?? "GLOBAL"}`}>{field.label}</strong>) : <em>暂无敏感提醒</em>}
          </div>
        </div>
      </motion.section>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>候选人资料</h2>
          <FileText size={19} />
        </div>
        <div className="profile-editor-head">
          <label>
            资料名称
            <input value={profile.name} onChange={(event) => onChangeProfile({ ...profile, name: event.target.value })} />
          </label>
          <label>
            说明
            <input value={profile.headline ?? ""} onChange={(event) => onChangeProfile({ ...profile, headline: event.target.value })} />
          </label>
          <button
            className="secondary-button inline"
            type="button"
            onClick={() => onChangeProfile({ ...profile, fields: [...profile.fields, { ...defaultField, key: `customField${profile.fields.length + 1}` }] })}
          >
            <Plus size={16} />
            新增字段
          </button>
        </div>
        <div className="editable-table">
          {profile.fields.map((field, index) => (
            <div className="editable-row" key={`${field.id ?? field.key}-${index}`}>
              <input aria-label="字段键" value={field.key} onChange={(event) => updateField(index, { key: event.target.value })} />
              <input aria-label="字段名" value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
              <input aria-label="字段值" value={field.value} onChange={(event) => updateField(index, { value: event.target.value })} />
              <select value={field.market ?? ""} onChange={(event) => updateField(index, { market: (event.target.value || null) as MarketCode | null })}>
                <option value="">通用</option>
                {Object.entries(marketLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
              <select value={field.sensitivity} onChange={(event) => updateField(index, { sensitivity: event.target.value as Sensitivity })}>
                {Object.entries(sensitivityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </motion.section>

      <div className="middle-grid">
        <motion.section className="panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>表单快照</h2>
            <Archive size={19} />
          </div>
          {snapshots.length ? (
            <>
              <div className="snapshot-picker">
                <label>
                  选择快照
                  <select value={selectedSnapshot?.id ?? ""} onChange={(event) => setSelectedSnapshotId(event.target.value)}>
                    {snapshots.map((snapshot) => (
                      <option key={snapshot.id} value={snapshot.id}>
                        {(snapshot.atsVendor || "通用表单")} · {snapshot.host || "本地页面"} · {snapshot.fieldCount} 字段
                      </option>
                    ))}
                  </select>
                </label>
                {selectedSnapshot && (
                  <div className="snapshot-summary">
                    <strong>{selectedSnapshot.title || selectedSnapshot.host || "未命名表单"}</strong>
                    <span>{selectedSnapshot.atsVendor || "通用表单"} · 安全 {selectedSnapshot.safeCount} · 待确认 {selectedSnapshot.reviewCount}</span>
                    <p>{selectedSnapshot.url}</p>
                  </div>
                )}
                {selectedSnapshot ? (
                  <SnapshotReplayPanel
                    snapshot={selectedSnapshot}
                    profile={currentProfile}
                    mappingRules={mappingRules}
                    title="当前快照回放"
                    contextTitle={`${currentProfile.name} · 填表资料库`}
                    onMessage={setProfileMessage}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState title="暂无表单快照" detail="在 Edge 扩展里点击保存表单快照后，这里会显示真实申请页字段。" tone="warning" icon={ShieldCheck} />
          )}
        </motion.section>

        <motion.section className="panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>最近填表运行</h2>
            <MousePointerClick size={19} />
          </div>
          {latestRun ? (
            <div className="run-card">
              <strong>{latestRun.atsVendor || "通用表单"} · {latestRun.mode}</strong>
              <span>识别 {latestRun.fieldsDetected} · 填写 {latestRun.fieldsFilled} · 跳过 {latestRun.fieldsSkipped}</span>
              <p>{latestRun.url}</p>
            </div>
          ) : (
            <EmptyState title="暂无运行记录" detail="用 Edge 扩展扫描或填写一次申请表后，这里会出现记录。" tone="info" icon={MousePointerClick} />
          )}
        </motion.section>
      </div>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>字段映射学习</h2>
          <Sparkles size={19} />
        </div>
        <div className="mapping-learning-panel">
          <div className="mapping-learning-copy">
            <span>学习队列</span>
            <strong>{selectedSnapshot ? `${mappingLearnableCount} 个字段可学习` : "等待表单快照"}</strong>
            <p>
              {selectedSnapshot
                ? `当前快照已有 ${mappingSavedCount} 条规则，${safeBatchCandidates.length} 条安全建议可批量保存，${mappingMissingValueCount} 条建议缺少资料值。`
                : "先在 Edge 扩展保存一次真实申请表快照，再回到这里沉淀可复用字段规则。"}
            </p>
          </div>
          <div className="mapping-learning-metrics">
            <Metric label="快照字段" value={String(selectedSnapshot?.fields.length ?? 0)} />
            <Metric label="可学习" value={String(mappingLearnableCount)} tone={mappingLearnableCount ? "success" : undefined} />
            <Metric label="安全建议" value={String(safeBatchCandidates.length)} tone={safeBatchCandidates.length ? "success" : undefined} />
          </div>
          <button className="secondary-button inline strong" disabled={busy || !safeBatchCandidates.length} onClick={saveSafeMappingSuggestions} type="button">
            批量保存安全建议
          </button>
        </div>
        {mappingCandidates.length ? (
          <div className="mapping-suggestion-strip">
            {mappingCandidates.slice(0, 8).map((item) => (
              <span className={item.safeToBatch ? "ready" : item.hasSavedRule ? "saved" : "review"} key={item.field.id}>
                {item.field.label} → {item.profileField?.label ?? "待选择"} · {item.hasSavedRule ? "已保存" : item.safeToBatch ? "可批量" : item.learnable ? sensitivityLabels[item.field.sensitivity] : "待人工"}
              </span>
            ))}
          </div>
        ) : null}
        {selectedSnapshot?.fields.length ? (
          <div className="field-map-grid">
            {selectedSnapshot.fields.slice(0, 24).map((field) => (
              <article className="field-map-card" key={field.id}>
                <div>
                  <strong>{field.label}</strong>
                  <span>
                    {field.inputType || "input"} · {field.required ? "必填" : "选填"} · {sensitivityLabels[field.sensitivity]} · 置信度 {field.confidence}
                  </span>
                </div>
                <select
                  value={mappingDrafts[field.id] ?? field.mappedKey ?? field.detectedKey ?? ""}
                  onChange={(event) => setMappingDrafts({ ...mappingDrafts, [field.id]: event.target.value })}
                >
                  <option value="">暂不映射</option>
                  {profile.fields.map((profileField) => (
                    <option key={`${field.id}-${profileField.key}-${profileField.market ?? "GLOBAL"}`} value={profileField.key}>
                      {profileField.label} · {profileField.key}
                    </option>
                  ))}
                </select>
                <button className="secondary-button inline strong" disabled={busy || !(mappingDrafts[field.id] || field.mappedKey || field.detectedKey)} onClick={() => saveMappingRule(field)} type="button">
                  保存映射
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="没有可学习字段" detail="先保存一个表单快照，再把字段映射到候选人资料。" tone="warning" icon={ShieldCheck} />
        )}
      </motion.section>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>已保存映射规则</h2>
          <BadgeCheck size={19} />
        </div>
        {mappingRules.length ? (
          <div className="mapping-rule-list">
            {mappingRules.slice(0, 12).map((rule) => (
              <article className="mapping-rule" key={rule.id}>
                <div>
                  <strong>{rule.labelPattern || rule.inputName || "未命名字段"}</strong>
                  <span>{rule.host || "全局"} · {rule.atsVendor || "通用"} · {rule.enabled ? "启用中" : "已停用"}</span>
                </div>
                <select value={getRuleDraft(rule).candidateKey} onChange={(event) => updateRuleDraft(rule, { candidateKey: event.target.value })}>
                  {profile.fields.map((profileField) => (
                    <option key={`${rule.id}-${profileField.key}-${profileField.market ?? "GLOBAL"}`} value={profileField.key}>
                      {profileField.label} · {profileField.key}
                    </option>
                  ))}
                </select>
                <select value={getRuleDraft(rule).sensitivity} onChange={(event) => updateRuleDraft(rule, { sensitivity: event.target.value as Sensitivity })}>
                  {Object.entries(sensitivityLabels).map(([value, label]) => (
                    <option key={`${rule.id}-${value}`} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="映射置信度"
                  max={100}
                  min={0}
                  type="number"
                  value={getRuleDraft(rule).confidence}
                  onChange={(event) => updateRuleDraft(rule, { confidence: Number(event.target.value) })}
                />
                <div className="button-row tight">
                  <button className="secondary-button inline" disabled={busy} onClick={() => onUpdateMappingRule({ id: rule.id, enabled: !rule.enabled })} type="button">
                    {rule.enabled ? "停用" : "启用"}
                  </button>
                  <button className="secondary-button inline strong" disabled={busy} onClick={() => saveRuleDraft(rule)} type="button">
                    保存
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无映射规则" detail="保存字段映射后，Edge 会优先按这些规则识别同类表单。" tone="info" icon={ShieldCheck} />
        )}
      </motion.section>
    </div>
  );
}

function ApplicationsView({
  jobs,
  applications,
  busy,
  onOpenPackage,
  onCreateApplication,
  onUpdateApplication,
  onScheduleFollowUps
}: {
  jobs: Job[];
  applications: Application[];
  busy: boolean;
  onOpenPackage: (jobId: string) => void;
  onCreateApplication: (jobId: string) => void;
  onUpdateApplication: (application: Pick<Application, "id" | "status" | "notes" | "nextAction" | "nextActionAt">) => void;
  onScheduleFollowUps: (updates: Array<Pick<Application, "id" | "status" | "notes" | "nextAction" | "nextActionAt">>) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Pick<Application, "id" | "status" | "notes" | "nextAction" | "nextActionAt">>>({});
  const [followUpExportMessage, setFollowUpExportMessage] = useState("未来 7 天的跟进节奏可复制或下载归档。");
  const applicationJobIds = new Set(applications.map((application) => application.jobId));
  const availableJobs = jobs.filter((job) => !applicationJobIds.has(job.id)).slice(0, 6);
  const readyApplications = applications.filter((application) => application.status === "PREPARED");
  const submittedApplications = applications.filter((application) => ["APPLIED", "OA", "INTERVIEW"].includes(application.status));
  const missingFollowUps = applications.filter((application) => !application.nextAction?.trim());
  const activeApplications = applications.filter(activeFollowUp);
  const sortedActiveFollowUps = sortFollowUps(activeApplications);
  const overdueApplications = sortedActiveFollowUps.filter((application) => (followUpDaysUntil(application.nextActionAt) ?? 9999) < 0);
  const unscheduledActiveApplications = sortedActiveFollowUps.filter((application) => !application.nextActionAt);
  const visibleUnscheduledActiveApplications = unscheduledActiveApplications.slice(0, 6);
  const weekFollowUpBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = dateFromToday(index);
    const key = localDateKey(date);
    return {
      key,
      label: followUpDayLabel(date, index),
      dateText: key,
      items: sortedActiveFollowUps.filter((application) => toDateInput(application.nextActionAt) === key)
    };
  });
  const todayFollowUpCount = weekFollowUpBuckets[0]?.items.length ?? 0;
  const weekFollowUpCount = weekFollowUpBuckets.reduce((total, bucket) => total + bucket.items.length, 0);
  const followUpQueue = applications
    .filter((application) => ["PREPARED", "APPLIED", "OA", "INTERVIEW"].includes(application.status) || !application.nextAction?.trim())
    .slice(0, 4);
  const primaryFollowUp = readyApplications[0] ?? submittedApplications[0] ?? missingFollowUps[0] ?? applications[0] ?? null;
  const pipelineNext = readyApplications.length
    ? {
        tone: "success",
        title: "优先处理已准备岗位",
        detail: `${readyApplications.length} 个岗位已准备好材料，可以打开投递包核对材料和表单快照。`
      }
    : submittedApplications.length
      ? {
          tone: "info",
          title: "检查已投递岗位回信",
          detail: `${submittedApplications.length} 个岗位已进入投递后跟进，建议更新回信、笔试或面试进展。`
        }
      : missingFollowUps.length
        ? {
            tone: "warning",
            title: "补齐下一步备注",
            detail: `${missingFollowUps.length} 条记录缺少下一步动作，补齐后管线会更可执行。`
          }
        : {
            tone: "neutral",
            title: "先把高匹配岗位加入管线",
            detail: "从可加入岗位或市场雷达选择目标，进入投递包准备材料。"
          };
  const grouped = Object.keys(statusLabels).map((status) => ({
    status: status as ApplicationStatus,
    items: applications.filter((application) => application.status === status)
  }));

  function draftFor(application: Application) {
    return drafts[application.id] ?? { id: application.id, status: application.status, notes: application.notes ?? "", nextAction: application.nextAction ?? "", nextActionAt: toDateInput(application.nextActionAt) };
  }

  function formatFollowUpLine(application: Application) {
    return `${application.job.company} · ${application.job.title} · ${statusLabels[application.status]} · ${application.nextAction || application.notes || "补齐下一步动作"}`;
  }

  function buildFollowUpPlanMarkdown() {
    const todayKey = localDateKey(new Date());
    const lines = [
      `# CareerPilot APAC 7日跟进节奏 · ${todayKey}`,
      "",
      "## 总览",
      `- 活跃投递：${activeApplications.length}`,
      `- 逾期跟进：${overdueApplications.length}`,
      `- 今日跟进：${todayFollowUpCount}`,
      `- 未来 7 天已排期：${weekFollowUpCount}`,
      `- 未排期活跃记录：${unscheduledActiveApplications.length}`,
      "",
      "## 逾期优先",
      ...(overdueApplications.length
        ? overdueApplications.slice(0, 8).map((application) => `- ${followUpDueLabel(application.nextActionAt)}：${formatFollowUpLine(application)}`)
        : ["- 暂无逾期跟进"]),
      "",
      "## 未来 7 天",
      ...weekFollowUpBuckets.flatMap((bucket) => [
        "",
        `### ${bucket.label} · ${bucket.dateText}`,
        ...(bucket.items.length
          ? bucket.items.map((application) => `- ${formatFollowUpLine(application)}`)
          : ["- 暂无排期"])
      ]),
      "",
      "## 未排期记录",
      ...(unscheduledActiveApplications.length
        ? unscheduledActiveApplications.map((application) => `- ${formatFollowUpLine(application)}`)
        : ["- 暂无未排期活跃记录"]),
      "",
      "## 操作边界",
      "- 跟进节奏只用于本地提醒和人工复盘，不自动投递、不自动提交、不绕验证码。",
      "- 真实回信、笔试、面试或拒信需要人工确认后再更新投递状态。"
    ];

    return lines.join("\n");
  }

  async function copyFollowUpPlan() {
    try {
      await navigator.clipboard.writeText(buildFollowUpPlanMarkdown());
      setFollowUpExportMessage("7日跟进节奏 Markdown 已复制。");
    } catch {
      setFollowUpExportMessage("复制失败，可以下载 7日跟进节奏 Markdown。");
    }
  }

  function downloadFollowUpPlan() {
    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-7日跟进节奏`)}.md`;
    const blob = new Blob([buildFollowUpPlanMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setFollowUpExportMessage(`已下载 ${filename}。`);
  }

  function downloadApplicationsCsv() {
    if (!applications.length) {
      setFollowUpExportMessage("暂无投递记录可导出。");
      return;
    }

    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-投递管线`)}.csv`;
    const csv = buildCsv(
      ["市场", "公司", "岗位", "地点", "状态", "投递日期", "回信日期", "下一步动作", "跟进日期", "备注", "岗位链接", "更新时间"],
      applications.map((application) => [
        marketLabels[application.job.market],
        application.job.company,
        application.job.title,
        application.job.location || "",
        statusLabels[application.status],
        toDateInput(application.appliedAt),
        toDateInput(application.responseAt),
        application.nextAction || "",
        toDateInput(application.nextActionAt),
        application.notes || "",
        application.job.sourceUrl || "",
        formatDateTime(application.updatedAt)
      ])
    );

    downloadTextFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    setFollowUpExportMessage(`已下载 ${filename}。`);
  }

  function scheduleMissingFollowUps() {
    if (!unscheduledActiveApplications.length) {
      setFollowUpExportMessage("当前没有需要自动排期的活跃记录。");
      return;
    }

    const updates = unscheduledActiveApplications.map((application, index) => {
      const offset = (index % 6) + 1;
      return {
        id: application.id,
        status: application.status,
        notes: application.notes ?? "",
        nextAction: application.nextAction?.trim() || defaultFollowUpAction(application.status),
        nextActionAt: localDateKey(dateFromToday(offset))
      };
    });

    onScheduleFollowUps(updates);
    setDrafts((current) => {
      const next = { ...current };
      for (const update of updates) {
        next[update.id] = update;
      }
      return next;
    });
    setFollowUpExportMessage(`已生成 ${updates.length} 条本地排期，保存后会刷新 7 日节奏。`);
  }

  return (
    <div className="view-stack">
      <PipelineSummary applications={applications} />

      <motion.section className="panel application-command-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>跟进控制台</h2>
            <p>优先处理已准备岗位，保持每条投递记录都有明确下一步。</p>
          </div>
          <Radar size={19} />
        </div>
        <div className="application-command-grid">
          <Metric label="已准备" value={String(readyApplications.length)} tone={readyApplications.length ? "success" : undefined} />
          <Metric label="投递后跟进" value={String(submittedApplications.length)} />
          <Metric label="缺少动作" value={String(missingFollowUps.length)} />
          <Metric label="候选岗位" value={String(availableJobs.length)} />
        </div>
        <div className={`application-next-step ${pipelineNext.tone}`}>
          <div>
            <strong>{pipelineNext.title}</strong>
            <span>{pipelineNext.detail}</span>
          </div>
          {primaryFollowUp ? (
            <button className="secondary-button inline strong" disabled={busy} onClick={() => onOpenPackage(primaryFollowUp.jobId)} type="button">
              打开优先投递包
            </button>
          ) : availableJobs[0] ? (
            <button className="secondary-button inline strong" disabled={busy} onClick={() => onCreateApplication(availableJobs[0].id)} type="button">
              加入首个岗位
            </button>
          ) : null}
        </div>
        {followUpQueue.length ? (
          <div className="follow-up-strip">
            {followUpQueue.map((application) => (
              <button key={application.id} onClick={() => onOpenPackage(application.jobId)} type="button">
                <strong>{application.job.company}</strong>
                <span>
                  {statusLabels[application.status]} · {application.nextAction?.trim() || application.notes?.trim() || "待补下一步"}
                  {application.nextActionAt ? ` · ${toDateInput(application.nextActionAt)}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </motion.section>

      <motion.section className="panel followup-calendar-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>7日跟进节奏</h2>
            <p>{followUpExportMessage}</p>
          </div>
          <div className="followup-calendar-actions">
            <button className="secondary-button inline" disabled={busy || !unscheduledActiveApplications.length} onClick={scheduleMissingFollowUps} type="button">
              一键排期未排期
            </button>
            <button className="secondary-button inline strong" disabled={busy || !activeApplications.length} onClick={copyFollowUpPlan} type="button">
              复制7日节奏
            </button>
            <button className="secondary-button inline" disabled={busy || !activeApplications.length} onClick={downloadFollowUpPlan} type="button">
              下载7日节奏.md
            </button>
            <button className="secondary-button inline export-button" disabled={busy || !applications.length} onClick={downloadApplicationsCsv} type="button">
              <FileDown size={14} />
              导出管线.csv
            </button>
          </div>
        </div>

        <div className="followup-calendar-summary">
          <Metric label="逾期" value={String(overdueApplications.length)} tone={overdueApplications.length ? "warning" : "success"} />
          <Metric label="今天" value={String(todayFollowUpCount)} tone={todayFollowUpCount ? "info" : undefined} />
          <Metric label="7天排期" value={String(weekFollowUpCount)} />
          <Metric label="未排期" value={String(unscheduledActiveApplications.length)} tone={unscheduledActiveApplications.length ? "warning" : "success"} />
        </div>

        {overdueApplications.length ? (
          <div className="followup-priority-strip">
            {overdueApplications.slice(0, 3).map((application) => (
              <button disabled={busy} key={application.id} onClick={() => onOpenPackage(application.jobId)} type="button">
                <span>{followUpDueLabel(application.nextActionAt)}</span>
                <strong>{application.job.company} · {application.job.title}</strong>
                <small>{application.nextAction || application.notes || "补齐下一步动作"}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="followup-calendar-grid">
          {weekFollowUpBuckets.map((bucket) => (
            <article className={bucket.items.length ? "followup-day-card has-items" : "followup-day-card"} key={bucket.key}>
              <div className="followup-day-head">
                <div>
                  <strong>{bucket.label}</strong>
                  <span>{bucket.dateText}</span>
                </div>
                <em>{bucket.items.length}</em>
              </div>
              {bucket.items.length ? (
                <div className="followup-day-items">
                  {bucket.items.slice(0, 3).map((application) => (
                    <button disabled={busy} key={application.id} onClick={() => onOpenPackage(application.jobId)} type="button">
                      <strong>{application.job.company}</strong>
                      <span>{application.job.title}</span>
                      <small>{application.nextAction || application.notes || statusLabels[application.status]}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p>暂无排期</p>
              )}
            </article>
          ))}
        </div>

        {unscheduledActiveApplications.length ? (
          <div className="unscheduled-followup-strip">
            <strong>未排期活跃记录</strong>
            <div>
              {visibleUnscheduledActiveApplications.slice(0, 4).map((application) => (
                <button disabled={busy} key={application.id} onClick={() => onOpenPackage(application.jobId)} type="button">
                  {application.job.company} · {application.job.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </motion.section>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>可加入管线的岗位</h2>
          <Plus size={19} />
        </div>
        {availableJobs.length ? (
          <div className="role-list dense">
            {availableJobs.map((job) => (
              <article className="role-row" key={job.id}>
                <div>
                  <strong>{job.title}</strong>
                  <span>
                    {job.company} · {marketLabels[job.market]} · {job.location || "地点待补充"}
                  </span>
                </div>
                <button className="secondary-button inline" disabled={busy} onClick={() => onCreateApplication(job.id)} type="button">
                  加入
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无可加入岗位" detail="去市场雷达录入或导入岗位后，这里会显示可加入管线的岗位。" tone="warning" icon={BriefcaseBusiness} />
        )}
      </motion.section>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>投递看板</h2>
          <BriefcaseBusiness size={19} />
        </div>
        <div className="application-board">
          {grouped
            .filter((column) => column.items.length > 0 || ["SAVED", "PREPARED", "APPLIED"].includes(column.status))
            .map((column) => (
              <section className="kanban-column" key={column.status}>
                <h3>
                  {statusLabels[column.status]}
                  <span>{column.items.length}</span>
                </h3>
                {column.items.length ? (
                  column.items.map((application) => {
                    const draft = draftFor(application);
                    return (
                      <article className="application-card editable" key={application.id}>
                        <strong>{application.job.company}</strong>
                        <span>{application.job.title}</span>
                        <p>{marketLabels[application.job.market]} · {application.job.location || "地点待补充"} · 更新 {formatDateTime(application.updatedAt)}</p>
                        <select
                          value={draft.status}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [application.id]: { ...draft, status: event.target.value as ApplicationStatus }
                            }))
                          }
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={draft.notes ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [application.id]: { ...draft, notes: event.target.value }
                            }))
                          }
                          placeholder="备注/复盘"
                        />
                        <input
                          placeholder="下一步动作，例如：3 天后查回信 / 准备 OA / 约模拟面试"
                          value={draft.nextAction ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [application.id]: { ...draft, nextAction: event.target.value }
                            }))
                          }
                        />
                        <label className="inline-date-field">
                          跟进日期
                          <input
                            value={draft.nextActionAt ?? ""}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [application.id]: { ...draft, nextActionAt: event.target.value }
                              }))
                            }
                            type="date"
                          />
                        </label>
                        <button className="secondary-button inline" disabled={busy} onClick={() => onUpdateApplication(draft)} type="button">
                          保存状态
                        </button>
                        <button className="secondary-button inline strong" disabled={busy} onClick={() => onOpenPackage(application.jobId)} type="button">
                          打开投递包
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <p className="column-empty">暂无记录</p>
                )}
              </section>
            ))}
        </div>
      </motion.section>
    </div>
  );
}

function MarketsView({
  jobs,
  busy,
  onOpenPackage,
  onAddJob,
  onUpdateJob,
  onImportCsv
}: {
  jobs: Job[];
  busy: boolean;
  onOpenPackage: (jobId: string) => void;
  onAddJob: (job: typeof defaultJob) => void;
  onUpdateJob: (job: Job) => void;
  onImportCsv: (csv: string) => void;
}) {
  const [jobDraft, setJobDraft] = useState(defaultJob);
  const [jobDrafts, setJobDrafts] = useState<Record<string, Job>>({});
  const [csv, setCsv] = useState(csvTemplate);
  const [search, setSearch] = useState("");
  const [marketFilter, setMarketFilter] = useState<MarketCode | "ALL">("ALL");
  const [archiveFilter, setArchiveFilter] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE");
  const [qualityFilter, setQualityFilter] = useState<JobQualityFilter>("ALL");
  const [qualityMessage, setQualityMessage] = useState("质量检查只帮助定位问题，不会自动归档或删除岗位。");
  const activeJobs = jobs.filter((job) => !job.archived);
  const duplicateKeys = duplicateJobKeys(activeJobs);
  const jobIssueMap = new Map(jobs.map((job) => [job.id, jobQualityIssues(job, duplicateKeys)]));
  const qualityCards = (Object.keys(jobQualityLabels) as JobQualityKey[]).map((key) => ({
    key,
    label: jobQualityLabels[key],
    count: activeJobs.filter((job) => jobIssueMap.get(job.id)?.includes(key)).length
  }));
  const totalQualityIssues = qualityCards.reduce((sum, item) => sum + item.count, 0);
  const cleanActiveJobs = activeJobs.filter((job) => !(jobIssueMap.get(job.id)?.length ?? 0));
  const jobHealthScore = activeJobs.length
    ? Math.max(0, Math.round(((activeJobs.length * qualityCards.length - totalQualityIssues) / (activeJobs.length * qualityCards.length)) * 100))
    : 100;
  const visibleJobs = jobs.filter((job) => {
    const haystack = [job.title, job.company, job.location, job.description].join(" ").toLowerCase();
    const matchesSearch = haystack.includes(search.trim().toLowerCase());
    const matchesMarket = marketFilter === "ALL" || job.market === marketFilter;
    const matchesArchive =
      archiveFilter === "ALL" ||
      (archiveFilter === "ARCHIVED" ? job.archived : !job.archived);
    const matchesQuality = qualityFilter === "ALL" || jobIssueMap.get(job.id)?.includes(qualityFilter);
    return matchesSearch && matchesMarket && matchesArchive && matchesQuality;
  });

  function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddJob(jobDraft);
    setJobDraft(defaultJob);
  }

  function editableJob(job: Job) {
    return jobDrafts[job.id] ?? job;
  }

  function updateJobDraft(job: Job, patch: Partial<Job>) {
    setJobDrafts((current) => ({
      ...current,
      [job.id]: { ...editableJob(job), ...patch }
    }));
  }

  function saveJobDraft(job: Job) {
    onUpdateJob(editableJob(job));
  }

  async function copyJobQualityReport() {
    const lines = [
      "# CareerPilot APAC 岗位数据健康清单",
      "",
      `生成时间：${new Date().toLocaleString("zh-CN")}`,
      `岗位健康分：${jobHealthScore}%`,
      `未归档岗位：${activeJobs.length}`,
      `质量就绪岗位：${cleanActiveJobs.length}`,
      "",
      ...qualityCards.flatMap((card) => {
        const affectedJobs = activeJobs.filter((job) => jobIssueMap.get(job.id)?.includes(card.key)).slice(0, 8);
        return [
          `## ${card.label}（${card.count}）`,
          ...(affectedJobs.length
            ? affectedJobs.map((job) => `- ${job.company} · ${job.title} · ${marketLabels[job.market]} · ${job.location || "地点待补"} · ${job.sourceUrl || "缺链接"}`)
            : ["- 暂无"])
        ];
      }),
      "",
      "## 处理建议",
      "- 缺链接：优先补官方申请链接，避免投递包无法跳转。",
      "- JD 太短：粘贴岗位描述后再生成材料包，减少模板化材料。",
      "- 低匹配/高风险：保留为备选或归档，避免占用每日打卡名额。",
      "- 疑似重复：确认是否同一岗位的不同链接，再归档低质量记录。",
      "",
      "边界：这份清单只辅助本地整理，不自动删除、不自动归档、不自动投递。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setQualityMessage("岗位数据健康清单已复制。");
    } catch {
      setQualityMessage("复制失败，可以按健康面板逐项筛选处理。");
    }
  }

  function downloadVisibleJobsCsv() {
    if (!visibleJobs.length) {
      setQualityMessage("当前筛选没有岗位可导出。");
      return;
    }

    const date = localDateKey(new Date());
    const filename = `${safeFileName(`${date}-岗位库-${marketFilter}-${archiveFilter}-${qualityFilter}`)}.csv`;
    const csv = buildCsv(
      ["市场", "公司", "岗位", "地点", "匹配分", "签证风险", "毕业生匹配", "归档", "质量问题", "岗位链接", "首次发现", "最近出现", "描述"],
      visibleJobs.map((job) => [
        marketLabels[job.market],
        job.company,
        job.title,
        job.location || "",
        job.matchScore ?? "",
        job.visaRisk || "",
        job.graduateFit || "",
        job.archived ? "是" : "否",
        (jobIssueMap.get(job.id) ?? []).map((key) => jobQualityLabels[key]).join("；"),
        job.sourceUrl || "",
        formatDateTime(job.firstSeenAt),
        formatDateTime(job.lastSeenAt),
        job.description
      ])
    );

    downloadTextFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    setQualityMessage(`已下载 ${filename}。`);
  }

  return (
    <div className="view-stack">
      <div className="middle-grid">
        <MarketSummary jobs={jobs} />
        <motion.section className="panel strategy-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>岗位入库策略</h2>
            <Radar size={19} />
          </div>
          <p>先用手动录入和 CSV 导入覆盖主要求职来源。系统按市场、公司、岗位和链接生成去重键，避免重复处理同一岗位。</p>
        </motion.section>
      </div>

      <motion.section className="panel job-quality-panel" variants={panelIn}>
        <div className="panel-title compact">
          <div>
            <h2>岗位数据健康</h2>
            <p>{cleanActiveJobs.length} / {activeJobs.length} 个未归档岗位可直接进入每日打卡或投递包。</p>
          </div>
          <strong>{jobHealthScore}%</strong>
        </div>
        <div className="progress-track">
          <span className="progress-fill success" style={{ width: `${jobHealthScore}%` }} />
        </div>
        <div className="job-quality-actions">
          <span className="helper-text">{qualityMessage}</span>
          <div>
            <button className="secondary-button inline strong" disabled={busy || !jobs.length} onClick={copyJobQualityReport} type="button">
              复制质量清单
            </button>
            <button className="secondary-button inline export-button" disabled={busy || !visibleJobs.length} onClick={downloadVisibleJobsCsv} type="button">
              <FileDown size={14} />
              导出岗位.csv
            </button>
            <button className="secondary-button inline" disabled={busy || qualityFilter === "ALL"} onClick={() => setQualityFilter("ALL")} type="button">
              清除质量筛选
            </button>
          </div>
        </div>
        <div className="job-quality-grid">
          {qualityCards.map((card) => (
            <button className={qualityFilter === card.key ? "job-quality-card active" : "job-quality-card"} key={card.key} onClick={() => setQualityFilter(card.key)} type="button">
              <span>{card.label}</span>
              <strong>{card.count}</strong>
              <p>{card.count ? "点击筛选处理" : "当前无问题"}</p>
            </button>
          ))}
        </div>
      </motion.section>

      <div className="form-grid">
        <motion.form className="panel form-panel" variants={panelIn} onSubmit={submitJob}>
          <div className="panel-title compact">
            <h2>手动录入岗位</h2>
            <Plus size={19} />
          </div>
          <label>
            市场
            <select value={jobDraft.market} onChange={(event) => setJobDraft({ ...jobDraft, market: event.target.value as MarketCode })}>
              {Object.entries(marketLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            公司
            <input required value={jobDraft.company} onChange={(event) => setJobDraft({ ...jobDraft, company: event.target.value })} />
          </label>
          <label>
            岗位
            <input required value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} />
          </label>
          <label>
            地点
            <input value={jobDraft.location} onChange={(event) => setJobDraft({ ...jobDraft, location: event.target.value })} />
          </label>
          <label>
            链接
            <input value={jobDraft.sourceUrl} onChange={(event) => setJobDraft({ ...jobDraft, sourceUrl: event.target.value })} />
          </label>
          <label>
            匹配分
            <input min="0" max="100" type="number" value={jobDraft.matchScore} onChange={(event) => setJobDraft({ ...jobDraft, matchScore: Number(event.target.value) })} />
          </label>
          <label className="full-span">
            描述
            <textarea value={jobDraft.description} onChange={(event) => setJobDraft({ ...jobDraft, description: event.target.value })} />
          </label>
          <button className="fill-button compact-button" disabled={busy} type="submit">
            岗位入库
          </button>
        </motion.form>

        <motion.section className="panel form-panel" variants={panelIn}>
          <div className="panel-title compact">
            <h2>CSV 导入</h2>
            <Upload size={19} />
          </div>
          <textarea className="csv-box" value={csv} onChange={(event) => setCsv(event.target.value)} />
          <button className="fill-button compact-button" disabled={busy} onClick={() => onImportCsv(csv)} type="button">
            导入并去重
          </button>
          <p className="helper-text">支持表头：市场、公司、岗位、地点、链接、描述、匹配分。</p>
        </motion.section>
      </div>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>岗位库</h2>
          <Archive size={19} />
        </div>
        <div className="filter-bar">
          <label>
            搜索岗位
            <input placeholder="公司、岗位、地点、关键词" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label>
            市场筛选
            <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value as MarketCode | "ALL")}>
              <option value="ALL">全部市场</option>
              {Object.entries(marketLabels).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            归档筛选
            <select value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value as "ACTIVE" | "ARCHIVED" | "ALL")}>
              <option value="ACTIVE">未归档</option>
              <option value="ARCHIVED">已归档</option>
              <option value="ALL">全部岗位</option>
            </select>
          </label>
          <label>
            质量筛选
            <select value={qualityFilter} onChange={(event) => setQualityFilter(event.target.value as JobQualityFilter)}>
              {Object.entries(jobQualityFilterLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <span className="filter-count">显示 {visibleJobs.length} / {jobs.length} 个岗位</span>
        </div>
        {visibleJobs.length ? (
          <div className="job-grid editable">
            {visibleJobs.map((job) => {
              const draft = editableJob(job);
              return (
                <article className="market-card job-card job-editor-card" key={job.id}>
                  <div className="job-editor-head">
                    <span className={`status-dot ${toneFromScore(draft.matchScore)}`} />
                    <div className="job-editor-score">
                      <em className={toneFromScore(draft.matchScore)}>{draft.matchScore ?? 0}</em>
                      <span>匹配分</span>
                    </div>
                  </div>
                  <div className="job-archive-strip">
                    <span>{draft.archived ? "已归档" : "未归档"}</span>
                    <label className="checkbox-row compact">
                      <input checked={draft.archived} onChange={(event) => updateJobDraft(job, { archived: event.target.checked })} type="checkbox" />
                      从日常雷达隐藏
                    </label>
                  </div>
                  <label className="full-span">
                    岗位
                    <input value={draft.title} onChange={(event) => updateJobDraft(job, { title: event.target.value })} />
                  </label>
                  <label>
                    公司
                    <input value={draft.company} onChange={(event) => updateJobDraft(job, { company: event.target.value })} />
                  </label>
                  <label>
                    市场
                    <select value={draft.market} onChange={(event) => updateJobDraft(job, { market: event.target.value as MarketCode })}>
                      {Object.entries(marketLabels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    地点
                    <input value={draft.location ?? ""} onChange={(event) => updateJobDraft(job, { location: event.target.value })} />
                  </label>
                  <label>
                    链接
                    <input value={draft.sourceUrl ?? ""} onChange={(event) => updateJobDraft(job, { sourceUrl: event.target.value })} />
                  </label>
                  <label>
                    匹配分
                    <input min="0" max="100" type="number" value={draft.matchScore ?? 0} onChange={(event) => updateJobDraft(job, { matchScore: Number(event.target.value) })} />
                  </label>
                  <label>
                    签证风险
                    <input value={draft.visaRisk ?? ""} onChange={(event) => updateJobDraft(job, { visaRisk: event.target.value })} />
                  </label>
                  <label>
                    毕业生匹配
                    <input value={draft.graduateFit ?? ""} onChange={(event) => updateJobDraft(job, { graduateFit: event.target.value })} />
                  </label>
                  <label className="full-span">
                    描述
                    <textarea value={draft.description} onChange={(event) => updateJobDraft(job, { description: event.target.value })} />
                  </label>
                  <div className="card-actions full-span">
                    <button className="secondary-button inline strong" disabled={busy || !draft.title.trim() || !draft.company.trim()} onClick={() => saveJobDraft(job)} type="button">
                      保存岗位
                    </button>
                    <button className="secondary-button inline" disabled={busy} onClick={() => onOpenPackage(job.id)} type="button">
                      投递包
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="岗位库为空" detail="先手动录入一个岗位，或粘贴 CSV 导入。" tone="warning" icon={BriefcaseBusiness} />
        )}
      </motion.section>
    </div>
  );
}

function InterviewsView({
  answers,
  busy,
  onAddAnswer,
  onUpdateAnswer,
  onLocalChange
}: {
  answers: AnswerItem[];
  busy: boolean;
  onAddAnswer: (answer: typeof defaultAnswer) => void;
  onUpdateAnswer: (answer: AnswerItem) => void;
  onLocalChange: (answers: AnswerItem[]) => void;
}) {
  const [draft, setDraft] = useState(defaultAnswer);

  function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAddAnswer(draft);
    setDraft(defaultAnswer);
  }

  function updateLocal(id: string, patch: Partial<AnswerItem>) {
    onLocalChange(answers.map((answer) => (answer.id === id ? { ...answer, ...patch } : answer)));
  }

  return (
    <div className="view-stack">
      <motion.form className="panel form-panel" variants={panelIn} onSubmit={submitAnswer}>
        <div className="panel-title compact">
          <h2>新增题库答案</h2>
          <ClipboardList size={19} />
        </div>
        <label className="full-span">
          问题
          <input required value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} />
        </label>
        <label>
          市场
          <select value={draft.market} onChange={(event) => setDraft({ ...draft, market: event.target.value as MarketCode })}>
            {Object.entries(marketLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          类型
          <input value={draft.roleFamily} onChange={(event) => setDraft({ ...draft, roleFamily: event.target.value })} />
        </label>
        <label>
          敏感度
          <select value={draft.sensitivity} onChange={(event) => setDraft({ ...draft, sensitivity: event.target.value as AnswerItem["sensitivity"] })}>
            {Object.entries(answerSensitivityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="full-span">
          答案
          <textarea required value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} />
        </label>
        <button className="fill-button compact-button" disabled={busy} type="submit">
          保存到题库
        </button>
      </motion.form>

      <motion.section className="panel" variants={panelIn}>
        <div className="panel-title compact">
          <h2>题库列表</h2>
          <FileText size={19} />
        </div>
        {answers.length ? (
          <div className="answer-editor-list">
            {answers.map((answer) => (
              <article className="answer-editor-card" key={answer.id}>
                <label className="full-span">
                  问题
                  <input value={answer.question} onChange={(event) => updateLocal(answer.id, { question: event.target.value })} />
                </label>
                <div className="answer-editor-meta-grid">
                  <label>
                    市场
                    <select value={answer.market ?? ""} onChange={(event) => updateLocal(answer.id, { market: event.target.value ? (event.target.value as MarketCode) : null })}>
                      <option value="">通用</option>
                      {Object.entries(marketLabels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    方向
                    <input value={answer.roleFamily ?? ""} onChange={(event) => updateLocal(answer.id, { roleFamily: event.target.value })} />
                  </label>
                  <label>
                    敏感度
                    <select value={answer.sensitivity} onChange={(event) => updateLocal(answer.id, { sensitivity: event.target.value as AnswerItem["sensitivity"] })}>
                      {Object.entries(answerSensitivityLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="full-span">
                  答案
                  <textarea value={answer.answer} onChange={(event) => updateLocal(answer.id, { answer: event.target.value })} />
                </label>
                <div className="card-actions full-span">
                  <div className="material-card-meta">
                    <span className="answer-chip accent">{answer.market ? marketLabels[answer.market] : "通用"}</span>
                    <span className="answer-chip">{answerSensitivityLabels[answer.sensitivity]}</span>
                  </div>
                  <button className="secondary-button inline strong" disabled={busy || !answer.question.trim() || !answer.answer.trim()} onClick={() => onUpdateAnswer(answer)} type="button">
                    保存答案
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="题库为空" detail="新增常见问题后，可以在申请表和面试准备时复用。" tone="info" icon={ClipboardList} />
        )}
      </motion.section>
    </div>
  );
}

function MarketSummary({ jobs }: { jobs: Job[] }) {
  const rows = (Object.keys(marketLabels) as MarketCode[]).map((market) => {
    const marketJobs = jobs.filter((job) => job.market === market);
    const average = marketJobs.length
      ? Math.round(marketJobs.reduce((sum, job) => sum + Number(job.matchScore ?? 50), 0) / marketJobs.length)
      : 0;

    return {
      code: marketLabels[market],
      value: average,
      tone: toneFromScore(average)
    };
  });

  return (
    <motion.section className="panel market-panel" variants={panelIn}>
      <div className="panel-title compact">
        <h2>市场雷达</h2>
        <Globe2 size={19} />
      </div>
      <div className="market-bars">
        {rows.map((row) => (
          <div className="market-row" key={row.code}>
            <strong>{row.code}</strong>
            <div className="bar-track">
              <span className={`bar-fill ${row.tone}`} style={{ width: `${row.value}%` }} />
            </div>
            <span>{row.value}%</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

function RecommendedRoles({ jobs, onOpenPackage }: { jobs: Job[]; onOpenPackage: (jobId: string) => void }) {
  return (
    <motion.section className="panel roles-panel" variants={panelIn}>
      <div className="panel-title compact">
        <h2>今日推荐岗位</h2>
        <Archive size={19} />
      </div>
      {jobs.length ? (
        <div className="role-list">
          {jobs.map((job) => (
            <article className="role-row" key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <span>
                  {job.company} · {marketLabels[job.market]}
                </span>
              </div>
              <div className="role-actions">
                <em className={toneFromScore(job.matchScore)}>{job.matchScore ?? 0} 匹配</em>
                <button className="secondary-button inline" onClick={() => onOpenPackage(job.id)} type="button">
                  投递包
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="暂无推荐岗位" detail="录入岗位后，系统会按匹配分排序显示。" tone="info" icon={Archive} />
      )}
    </motion.section>
  );
}

function PipelineSummary({ applications }: { applications: Application[] }) {
  const [reviewMessage, setReviewMessage] = useState("按市场和状态复盘投递质量，避免只看投递数量。");
  const tiles: Array<[string, number]> = [
    ["已收藏", applications.filter((item) => item.status === "SAVED").length],
    ["已准备", applications.filter((item) => item.status === "PREPARED").length],
    ["已投递", applications.filter((item) => item.status === "APPLIED").length],
    ["笔试", applications.filter((item) => item.status === "OA").length],
    ["面试", applications.filter((item) => item.status === "INTERVIEW").length]
  ];
  const submittedStatuses: ApplicationStatus[] = ["APPLIED", "OA", "INTERVIEW", "REJECTED", "OFFER"];
  const responseStatuses: ApplicationStatus[] = ["OA", "INTERVIEW", "REJECTED", "OFFER"];
  const activeCount = applications.filter(activeFollowUp).length;
  const submittedCount = applications.filter((application) => submittedStatuses.includes(application.status)).length;
  const responseCount = applications.filter((application) => responseStatuses.includes(application.status)).length;
  const interviewCount = applications.filter((application) => ["INTERVIEW", "OFFER"].includes(application.status)).length;
  const staleActiveCount = applications.filter((application) => activeFollowUp(application) && (daysSince(application.updatedAt) ?? 0) >= 14).length;
  const missingNextActionCount = applications.filter((application) => activeFollowUp(application) && !application.nextAction?.trim()).length;
  const responseRate = submittedCount ? Math.round((responseCount / submittedCount) * 100) : 0;
  const interviewRate = submittedCount ? Math.round((interviewCount / submittedCount) * 100) : 0;
  const marketFunnel = (Object.keys(marketLabels) as MarketCode[])
    .map((market) => {
      const items = applications.filter((application) => application.job.market === market);
      const submitted = items.filter((application) => submittedStatuses.includes(application.status)).length;
      const responses = items.filter((application) => responseStatuses.includes(application.status)).length;
      const active = items.filter(activeFollowUp).length;
      return {
        market,
        total: items.length,
        submitted,
        responses,
        active,
        responseRate: submitted ? Math.round((responses / submitted) * 100) : 0
      };
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => right.total - left.total || right.responseRate - left.responseRate);
  const strongestMarket = marketFunnel[0];
  const reviewNextStep = staleActiveCount
    ? `先处理 ${staleActiveCount} 条超过 14 天未更新的活跃记录。`
    : missingNextActionCount
      ? `先补齐 ${missingNextActionCount} 条活跃记录的下一步动作。`
      : strongestMarket
        ? `继续观察 ${marketLabels[strongestMarket.market]} 市场，当前记录 ${strongestMarket.total} 条、回应率 ${strongestMarket.responseRate}%。`
        : "先把高匹配岗位加入投递管线，再开始复盘。";

  async function copyPipelineReview() {
    const lines = [
      `# CareerPilot APAC 投递复盘 · ${localDateKey(new Date())}`,
      "",
      "## 漏斗总览",
      `- 管线记录：${applications.length}`,
      `- 已投递/进入流程：${submittedCount}`,
      `- 有回应记录：${responseCount}`,
      `- 面试/Offer：${interviewCount}`,
      `- 有效回应率：${responseRate}%`,
      `- 面试推进率：${interviewRate}%`,
      `- 活跃跟进：${activeCount}`,
      `- 超过 14 天未更新：${staleActiveCount}`,
      `- 缺少下一步动作：${missingNextActionCount}`,
      "",
      "## 市场分布",
      ...(marketFunnel.length
        ? marketFunnel.map((row) => `- ${marketLabels[row.market]}：记录 ${row.total}，已投 ${row.submitted}，回应 ${row.responses}，活跃 ${row.active}，回应率 ${row.responseRate}%`)
        : ["- 暂无市场数据"]),
      "",
      "## 下一步",
      `- ${reviewNextStep}`,
      "",
      "边界：这份复盘只用于本地决策，不自动投递、不自动联系公司、不改变外部平台状态。"
    ];

    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setReviewMessage("投递复盘 Markdown 已复制。");
    } catch {
      setReviewMessage("复制失败，可以根据复盘面板手动整理。");
    }
  }

  return (
    <motion.section className="panel pipeline-panel" variants={panelIn}>
      <div className="panel-title compact">
        <div>
          <h2>投递复盘</h2>
          <p>{reviewMessage}</p>
        </div>
        <BadgeCheck size={19} />
      </div>
      <div className="pipeline-grid">
        {tiles.map(([label, value]) => (
          <div className="pipeline-tile" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="pipeline-review-panel">
        <div className="pipeline-review-metrics">
          <Metric label="有效回应率" value={`${responseRate}%`} tone={responseRate ? "success" : undefined} />
          <Metric label="面试推进率" value={`${interviewRate}%`} tone={interviewRate ? "info" : undefined} />
          <Metric label="活跃跟进" value={String(activeCount)} />
          <Metric label="卡住记录" value={String(staleActiveCount)} tone={staleActiveCount ? "warning" : "success"} />
        </div>
        <div className="pipeline-review-next">
          <span>复盘动作</span>
          <strong>{reviewNextStep}</strong>
          <button className="secondary-button inline strong" disabled={!applications.length} onClick={copyPipelineReview} type="button">
            复制投递复盘
          </button>
        </div>
      </div>
      {marketFunnel.length ? (
        <div className="market-funnel-list">
          {marketFunnel.slice(0, 5).map((row) => (
            <article className="market-funnel-row" key={row.market}>
              <div>
                <strong>{marketLabels[row.market]}</strong>
                <span>记录 {row.total} · 已投 {row.submitted} · 活跃 {row.active}</span>
              </div>
              <div className="market-funnel-bar">
                <span style={{ width: `${Math.min(100, row.responseRate)}%` }} />
              </div>
              <em>{row.responseRate}% 回应</em>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="暂无复盘数据" detail="把岗位加入管线并更新投递状态后，这里会显示市场漏斗。" tone="info" icon={BadgeCheck} />
      )}
    </motion.section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "info" | "warning" }) {
  return (
    <div className={tone ? `metric-tile ${tone}` : "metric-tile"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RuleItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rule-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({
  title,
  detail,
  tone = "neutral",
  icon: Icon = Info,
  action
}: {
  title: string;
  detail: string;
  tone?: FeedbackTone;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className={`empty-state ${tone}`}>
      <div className="empty-state-icon">
        <Icon size={18} />
      </div>
      <strong>{title}</strong>
      <span>{detail}</span>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
