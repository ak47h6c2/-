import { createHash } from "node:crypto";
import type { MarketCode, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { sampleCandidateProfile } from "@careerpilot/shared";
import { scoreJob, parseDeadline } from "./job-matching";

export const marketLabels: Record<MarketCode, string> = {
  AU: "澳洲",
  SG: "新加坡",
  HK: "香港",
  CN: "中国大陆",
  GLOBAL: "远程/全球"
};

export function makeJobHash(input: {
  market: MarketCode;
  company: string;
  title: string;
  sourceUrl?: string | null;
}) {
  const key = [input.market, input.company, input.title, input.sourceUrl || ""]
    .map((value) => value.trim().toLowerCase())
    .join("|");
  return createHash("sha1").update(key).digest("hex");
}

const initialJobs: Array<{
  market: MarketCode;
  company: string;
  title: string;
  location: string;
  description: string;
  sourceUrl: string;
  matchScore: number;
  visaRisk: string;
  graduateFit: string;
}> = [
  {
    market: "SG",
    company: "Shopee SG",
    title: "Backend Engineer Intern",
    location: "Singapore",
    description: "适合后端、API、数据库方向；关注英文简历和基础算法。",
    sourceUrl: "https://careers.shopee.sg/",
    matchScore: 86,
    visaRisk: "中",
    graduateFit: "高"
  },
  {
    market: "CN",
    company: "字节跳动",
    title: "后端开发实习生",
    location: "上海",
    description: "中国大陆校招/实习方向，优先准备笔试、项目深挖和中文自我介绍。",
    sourceUrl: "https://jobs.bytedance.com/",
    matchScore: 92,
    visaRisk: "低",
    graduateFit: "高"
  },
  {
    market: "HK",
    company: "HK FinTech",
    title: "Business Analyst Graduate",
    location: "Hong Kong",
    description: "金融科技 BA 路线，适合双语沟通、SQL、业务分析和项目案例。",
    sourceUrl: "https://example.com/hk-fintech-ba",
    matchScore: 74,
    visaRisk: "中",
    graduateFit: "中"
  },
  {
    market: "AU",
    company: "Canva",
    title: "Graduate Software Engineer",
    location: "Sydney",
    description: "澳洲毕业生岗位，竞争强，适合作为高质量少量投递目标。",
    sourceUrl: "https://www.lifeatcanva.com/",
    matchScore: 68,
    visaRisk: "高",
    graduateFit: "中"
  }
];

const initialAnswers: Prisma.AnswerVaultItemCreateManyInput[] = [
  {
    question: "为什么选择这家公司？",
    answer: "我会从产品、技术栈、业务场景和岗位要求四个角度回答，并结合自己的项目经历说明匹配点。",
    market: "GLOBAL",
    roleFamily: "通用",
    sensitivity: "REVIEW"
  },
  {
    question: "请介绍一个你最有代表性的项目。",
    answer: "按 STAR 结构组织：背景、任务、技术方案、结果指标，并准备一版英文和一版中文。",
    market: "GLOBAL",
    roleFamily: "Software / Data",
    sensitivity: "SAFE"
  },
  {
    question: "是否需要签证担保？",
    answer: "该问题必须按真实情况人工确认，不自动填写。不同市场使用不同版本答案。",
    market: "GLOBAL",
    roleFamily: "签证/合规",
    sensitivity: "SENSITIVE"
  }
];

const initialResumeVersions: Prisma.ResumeVersionCreateManyInput[] = [
  {
    name: "中国大陆校招/实习简历",
    market: "CN",
    roleFamily: "Software / Data / BA",
    language: "zh",
    content: "突出校招身份、项目深挖、技术栈、实习/课程项目和笔试准备情况。",
    isDefault: true
  },
  {
    name: "新加坡英文 IT 简历",
    market: "SG",
    roleFamily: "Software / Data",
    language: "en",
    content: "Focus on projects, API/database experience, English communication and regional mobility.",
    isDefault: true
  },
  {
    name: "香港金融科技 BA 简历",
    market: "HK",
    roleFamily: "Business Analyst / FinTech",
    language: "zh-en",
    content: "突出 SQL、金融科技项目、双语沟通、业务分析和 stakeholder 管理。",
    isDefault: false
  }
];

let seedPromise: Promise<void> | null = null;

export function ensureSeedData() {
  seedPromise ??= seedData();
  return seedPromise;
}

async function seedData() {
  const profileCount = await prisma.candidateProfile.count();

  if (profileCount === 0) {
    await prisma.candidateProfile.create({
      data: {
        name: "我的求职资料",
        headline: "APAC IT 求职资料库",
        fields: {
          create: sampleCandidateProfile.map((field) => ({
            key: field.key,
            label: field.label,
            value: field.value,
            market: field.market,
            sensitivity: field.sensitivity.toUpperCase() as Prisma.CandidateProfileFieldCreateInput["sensitivity"]
          }))
        }
      }
    });
  }

  const sourceCount = await prisma.jobSource.count();

  if (sourceCount === 0) {
    await prisma.jobSource.createMany({
      data: [
        { name: "手动录入", market: "GLOBAL", sourceType: "MANUAL", reliability: 95 },
        { name: "公司官网", market: "GLOBAL", sourceType: "COMPANY_SITE", reliability: 85 },
        { name: "平台导入", market: "GLOBAL", sourceType: "ATS", reliability: 75 }
      ]
    });
  }

  const manualSource = await prisma.jobSource.findFirst({
    where: { name: "手动录入" }
  });

  for (const job of initialJobs) {
    const sourceHash = makeJobHash(job);
    const exists = await prisma.job.findFirst({ where: { sourceHash } });

    if (!exists) {
      await prisma.job.create({
        data: {
          ...job,
          sourceHash,
          sourceId: manualSource?.id,
          language: job.market === "CN" ? "zh" : "en"
        }
      });
    }
  }

  const jobsNeedingMetadata = await prisma.job.findMany({
    where: {
      OR: [
        { visaRisk: null },
        { graduateFit: null },
        { visaRisk: { contains: "?" } },
        { graduateFit: { contains: "?" } }
      ]
    }
  });

  for (const job of jobsNeedingMetadata) {
    const scored = scoreJob(job);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        matchScore: job.matchScore ?? scored.matchScore,
        visaRisk: job.visaRisk && !job.visaRisk.includes("?") ? job.visaRisk : scored.visaRisk,
        graduateFit: job.graduateFit && !job.graduateFit.includes("?") ? job.graduateFit : scored.graduateFit
      }
    });
  }

  const answerCount = await prisma.answerVaultItem.count();

  if (answerCount === 0) {
    await prisma.answerVaultItem.createMany({ data: initialAnswers });
  }

  const resumeCount = await prisma.resumeVersion.count();

  if (resumeCount === 0) {
    await prisma.resumeVersion.createMany({ data: initialResumeVersions });
  }

  const jobsWithoutParseResults = await prisma.job.findMany({
    where: { parseResult: null }
  });

  for (const job of jobsWithoutParseResults) {
    const scored = scoreJob(job);
    await prisma.jobParseResult.create({
      data: {
        jobId: job.id,
        rawText: [job.title, job.company, job.location, job.description].filter(Boolean).join("\n"),
        keywordsJson: JSON.stringify(scored.keywords),
        positiveReasonsJson: JSON.stringify(scored.positiveReasons),
        negativeReasonsJson: JSON.stringify(scored.negativeReasons),
        riskSignalsJson: JSON.stringify(scored.riskSignals),
        deadline: parseDeadline(job.description),
        confidence: Math.min(95, 60 + scored.keywords.length * 5)
      }
    });
  }

  const syncLogCount = await prisma.sourceSyncLog.count();

  if (syncLogCount === 0 && manualSource) {
    await prisma.sourceSyncLog.create({
      data: {
        sourceId: manualSource.id,
        action: "seed",
        status: "success",
        message: "已初始化本地演示数据源"
      }
    });
  }

  const applicationCount = await prisma.application.count();

  if (applicationCount === 0) {
    const jobs = await prisma.job.findMany({
      orderBy: [{ matchScore: "desc" }, { firstSeenAt: "desc" }],
      take: 3
    });

    for (const [index, job] of jobs.entries()) {
      await prisma.application.create({
        data: {
          jobId: job.id,
          status: index === 0 ? "PREPARED" : "SAVED",
          notes: index === 0 ? "今日优先准备投递材料" : "等待确认岗位要求"
        }
      });
    }
  }
}
