import type { Job, ResumeVersion, AnswerVaultItem } from "@prisma/client";
import { marketLabels } from "./seed";

type MaterialContext = {
  job: Job;
  resume?: ResumeVersion | null;
  answers: AnswerVaultItem[];
  parseReasons: string[];
};

function topReasons(reasons: string[]) {
  return reasons.length > 0 ? reasons.slice(0, 3) : ["岗位方向与当前求职目标有基础匹配", "需要人工确认 JD 细节", "提交前检查工作权利和地点要求"];
}

export function buildMaterialDrafts({ job, resume, answers, parseReasons }: MaterialContext) {
  const reasons = topReasons(parseReasons);
  const answerRefs = answers.slice(0, 3).map((item) => `- ${item.question}: ${item.answer}`).join("\n");
  const resumeName = resume?.name || `${marketLabels[job.market]} IT 通用简历`;

  return [
    {
      draftType: "fit_summary",
      title: `${job.company} · ${job.title} 匹配摘要`,
      content: [`推荐简历版本：${resumeName}`, "", "岗位匹配点：", ...reasons.map((reason) => `- ${reason}`)].join("\n")
    },
    {
      draftType: "cover_letter",
      title: `${job.company} Cover Letter 大纲`,
      content: [
        `Dear ${job.company} Hiring Team,`,
        "",
        `我想申请 ${job.title}。我会重点突出 IT 项目、数据库/API 能力，以及跨市场求职的适应能力。`,
        "",
        "建议展开：",
        ...reasons.map((reason) => `- ${reason}`),
        "",
        "提交前请把这份草稿改成真实经历，不要直接复制模板。"
      ].join("\n")
    },
    {
      draftType: "screener_answers",
      title: `${job.company} 筛选题回答草稿`,
      content: answerRefs || "暂无可引用答案。请先在笔试面试库里补充常见问题。"
    }
  ];
}
