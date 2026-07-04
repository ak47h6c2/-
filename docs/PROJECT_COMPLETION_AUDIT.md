# CareerPilot APAC 项目收尾审计

审计日期：2026-07-04

## 结论

当前项目已达到个人本地版 MVP + 最后一轮前端优化的收尾状态。系统已经覆盖本地资料维护、岗位入库、数据源同步、每日打卡、投递包、材料库、题库、投递管线、Edge 安全填表、备份恢复、中文 UI、Figma 设计系统和自动化验收。

当前结论不代表商业化 SaaS 已完成。登录、多用户、云同步、支付、付费岗位数据库、无人值守投递、验证码绕过和自动最终提交均不在本阶段范围内。

## 验收证据

- 完整验收：`output/verification/ACCEPTANCE.md`
- 结构化报告：`output/verification/verify-report.json`
- 最新状态：`Status: PASS`
- Edge 扩展：`edge extension smoke | PASS`
- 设计系统：35 tokens，17 components，18 quality gates
- Figma hash：`616ca4ad02bc87a1c00d0fefd84133a9ad0d5f8cc6e78685d3e532505e081bce`
- 视觉质量：最大横向溢出 0，裁切控件 0，console errors 0
- CSV 下载：岗位库 2/2，投递管线 2/2
- 备份恢复：导入岗位 1、投递 1、表单快照 1、字段 2

## 范围核对

| 模块 | 状态 | 当前证据 |
| --- | --- | --- |
| 中文本地工作台 | 完成 | `apps/web/src/app/page.tsx`，视觉 smoke 桌面/移动 9 个工作区 |
| 资料维护 | 完成 | `/api/profile`，`/api/autofill/profile`，填表资料库 UI |
| 岗位入库 | 完成 | `/api/jobs`，`/api/jobs/import`，`/api/jobs/import/clipboard` |
| 数据源管理 | 完成 | `/api/job-sources`，`/api/job-sources/sync`，每日岗位刷新 |
| 岗位解析与匹配 | 完成 | `apps/web/src/lib/job-import.ts`，`apps/web/src/lib/job-matching.ts`，`/api/jobs/parse` |
| 今日打卡 | 完成 | `/api/daily-sprint/plan`，每日短名单、行动队列、计划下载 |
| 投递包 | 完成 | `/api/jobs/[id]/package`，材料、申请记录、表单快照绑定 |
| 投递管线 | 完成 | `/api/applications`，7 日跟进、投递复盘、管线 CSV |
| 材料库 | 完成 | `/api/resumes`，`/api/materials`，`/api/materials/generate` |
| 题库 | 完成 | `/api/answer-vault`，答案安全等级和本地复用 |
| Edge 安全填表 | 完成 | `apps/edge-extension`，7 类 ATS smoke：Workday、Greenhouse、Lever、SmartRecruiters、Ashby、BambooHR、通用表单 |
| 表单快照与映射 | 完成 | `/api/autofill/snapshots`，`/api/autofill/mapping-rules`，快照回放 |
| 本地备份恢复 | 完成 | `/api/backup/export`，`/api/backup/preview`，`/api/backup/import` |
| 设计系统 / Figma | 完成 | `apps/web/design-system/careerpilot-apac.design-system.json` 0.6.0，Figma 文件 `th3k16oNdYatOFTUAfdbqc` |
| 最后前端优化 | 完成 | `export-button`、移动端两列动作区、按钮高度收敛、轻微错峰动效 |

## 自动化边界

系统固定为辅助型求职工具：

- 不自动提交申请。
- 不绕过验证码。
- 不自动上传文件。
- 不使用登录态抓取私有岗位。
- 不填敏感字段，只提示人工确认。
- 外部申请链接只作为人工跳转入口。

## 当前可运行命令

```powershell
npm run dev
npm run verify
npm run verify:edge
npm run smoke:cleanup -w @careerpilot/web
```

阶段验收建议继续使用：

```powershell
npm run verify:edge
```

该命令覆盖文档、设计系统、类型检查、lint、build、API smoke、视觉 smoke、测试数据清理和 Edge 扩展 smoke。

## 保留风险

- 真实岗位数据质量仍取决于用户导入来源；当前只支持公开页面、CSV、剪贴板和邮件提醒文本，不接付费数据库。
- 材料生成仍是本地模板，不接 OpenAI API，也不做自动简历文件上传。
- Edge 扩展已覆盖常见 ATS 实验表单，但真实网站 DOM 会变化，后续需要按实际遇到的网站继续追加规则。
- Figma 0.6.0 已同步关键规范页；如要形成完整商用设计库，还可以继续把每个组件拆成正式 variant set 和 Code Connect。
- 当前仓库在本地工作区中整体未跟踪，交付前如需要版本化，应单独初始化提交策略。

## 下一阶段建议

个人使用优先级：

1. 用真实岗位来源跑 1 周，观察数据源同步和每日打卡是否节省时间。
2. 在 Edge 真实申请页保存 10 到 20 个表单快照，补充字段映射规则。
3. 把自己的真实简历版本、题库答案和资料字段补齐。
4. 每周导出 `投递管线.csv` 和 `岗位库.csv`，复盘市场命中率。
5. 再决定是否接 OpenAI API 做材料草稿增强。
