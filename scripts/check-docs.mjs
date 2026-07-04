import fs from "node:fs/promises";

const checks = [
  {
    file: "README.md",
    terms: [
      "docs/LOCAL_USER_GUIDE.md",
      "CSV",
      "smoke:cleanup",
      "Edge 扩展",
      "本地备份",
      "npm run verify"
    ]
  },
  {
    file: "docs/LOCAL_USER_GUIDE.md",
    terms: [
      "每日流程",
      "本地启用清单",
      "全局搜索",
      "今日行动队列",
      "7日跟进节奏",
      "一键排期未排期",
      "CSV 文件导入",
      "投递包",
      "岗位数据健康",
      "Edge 扩展",
      "填表资料库",
      "资料库完整度",
      "填表速查包",
      "本地备份",
      "本地健康检查",
      "不自动提交",
      "不绕过验证码",
      "smoke:cleanup"
    ]
  }
];

const results = [];

for (const item of checks) {
  const content = await fs.readFile(item.file, "utf8");
  const missing = item.terms.filter((term) => !content.includes(term));
  results.push({
    file: item.file,
    ok: missing.length === 0,
    terms: item.terms.length,
    missing
  });
}

const ok = results.every((item) => item.ok);
const summary = {
  ok,
  checkedFiles: results.length,
  checkedTerms: results.reduce((sum, item) => sum + item.terms, 0),
  results
};

console.log(JSON.stringify(summary));

if (!ok) {
  process.exitCode = 1;
}
