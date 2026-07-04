# CareerPilot APAC

CareerPilot APAC 是一套面向亚太求职场景的本地优先求职工作台，适合正在投递中国大陆、新加坡、香港、澳洲和远程 IT 岗位的个人用户。它的目标不是无人值守海投，而是把资料维护、岗位入库、每日投递、材料准备、投递跟进和 Edge 辅助填表串成一个可持续使用的闭环。

当前版本是个人本地版：数据默认保存在本机 SQLite 数据库里，不包含登录、多用户、云同步、支付或商业化后台。

## 主要功能

- `填表资料库`：维护姓名、联系方式、教育经历、项目经历、工作权利、常见筛选题回答等复用信息。
- `数据源`：支持 CSV、表格文本、剪贴板、邮件提醒片段、公开岗位页面内容导入。
- `市场雷达`：查看岗位市场、公司、地点、链接、匹配分、关键词、签证风险、加分/扣分理由。
- `今日打卡`：生成每天的投递任务，把岗位转成可执行的每日投递清单。
- `投递包`：围绕单个岗位集中处理 JD、申请状态、材料草稿、简历版本、题库答案和 Edge 表单快照。
- `材料库`：用本地模板生成可编辑的 Cover Letter 大纲、筛选题回答草稿和 JD 对齐卖点。
- `投递管线`：跟踪未投递、已投递、笔试、面试、拒信、offer 等状态。
- `笔试面试库`：沉淀笔试、OA、面试题、STAR 回答和复盘。
- `Edge 扩展`：在 Microsoft Edge 中扫描申请表，填写安全字段，跳过敏感字段，不点击最终提交。
- `本地备份`：导出和恢复 CareerPilot APAC JSON 备份。
- `Figma 设计系统`：包含中文组件库、设计 token、动效规范和交付脚本。

## 快速启动

在项目根目录打开 PowerShell：

```powershell
cd "C:\Users\HECATE\Documents\求职推荐系统 it方向 开发"
npm install
npm run db:generate
npm run db:push
npm run dev
```

启动后打开：

```text
http://localhost:3000
```

如果端口被占用，终端会提示新的本地地址，按提示打开即可。

## 新手使用手册

第一次使用建议按这个顺序：

1. 打开 `填表资料库`，先录入个人基础信息、教育经历、项目经历、工作权利和常用回答。
2. 打开 `数据源`，导入 CSV、剪贴板岗位表格、邮件提醒片段或公开岗位文本。
3. 打开 `市场雷达`，检查岗位是否正确识别公司、市场、地点、链接和关键词。
4. 打开 `今日打卡`，生成当天投递任务。
5. 选择一个岗位进入 `投递包`，生成材料草稿并确认申请状态。
6. 在 Edge 中打开官方申请链接，用扩展保存表单快照并填写安全字段。
7. 回到 `投递管线`，更新岗位状态和下一步跟进时间。
8. 每周在 `本地备份` 导出一次 JSON 备份。

更详细的新手教程见：

- [新手使用手册](docs/BEGINNER_GUIDE.md)
- [本地使用指南](docs/LOCAL_USER_GUIDE.md)
- [项目完成度审计](docs/PROJECT_COMPLETION_AUDIT.md)

## Edge 扩展安装

扩展目录：

```text
apps/edge-extension
```

安装步骤：

1. 打开 Microsoft Edge。
2. 进入 `edge://extensions`。
3. 开启 `开发人员模式`。
4. 点击 `加载解压缩的扩展`。
5. 选择 `apps/edge-extension` 文件夹。
6. 在官方申请页面点击 CareerPilot 扩展按钮。

推荐流程：

1. 在 Web 工作台打开 `投递包`。
2. 点击 `设为当前 Edge 申请`。
3. 在 Edge 打开官方申请页面。
4. 点击扩展中的 `保存表单快照`。
5. 点击 `填写安全字段`。
6. 对签证、薪资、工作权利、文件上传、声明类问题和最终提交按钮进行人工确认。

## 岗位数据导入格式

CSV 或表格文本推荐字段：

```text
市场,公司,岗位,地点,链接,描述,来源,匹配分,发布时间
```

也可以粘贴结构化文本：

```text
Shopee | Software Engineer Intern | Singapore | https://example.com/job
要求 JavaScript、React、API、数据库，2027 届可投。
```

系统会基于岗位链接或 `sourceHash` 去重。重复导入同一岗位时，不会重复创建记录，会更新最后发现时间。

## 常用命令

```powershell
npm run db:generate
npm run db:push
npm run dev
npm run docs:check
npm run typecheck
npm run lint
npm run build
npm run verify
npm run verify:edge
npm run smoke:cleanup -w @careerpilot/web
```

单独调试 Edge 扩展：

```powershell
npm run build -w @careerpilot/edge-extension
npm run smoke -w @careerpilot/edge-extension
```

## 项目结构

```text
apps/web              Next.js 本地 Web 工作台
apps/edge-extension   Microsoft Edge 辅助填表扩展
packages/shared       共享字段规则、市场枚举和示例资料
docs                  中文手册、审计文档和使用指南
scripts               项目级验证脚本
```

## 数据和隐私边界

这个项目默认把个人数据放在本机，不应该把真实简历、环境变量、SQLite 数据库或验证输出提交到 GitHub。

已忽略的本地产物包括：

- `.env` 和 `.env.*`
- `dev.db`、`*.sqlite`
- `node_modules/`
- `.next/`
- `output/`
- `*.log`
- `*.tsbuildinfo`

自动化边界：

- 不自动点击最终提交。
- 不绕过验证码、登录墙或访问限制。
- 不自动上传文件。
- 不伪造学历、经历、签证或工作权利信息。
- 不抓取需要登录授权或禁止自动化访问的数据。

## 设计系统

设计系统文件：

```text
apps/web/design-system/careerpilot-apac.design-system.json
apps/web/design-system/FIGMA_HANDOFF.md
apps/web/design-system/generated/careerpilot-figma-library.use-figma.js
```

本地预览：

```text
http://localhost:3000/design-system
```

重新生成 Figma 交付脚本：

```powershell
npm run figma:export -w @careerpilot/web
```

## 验证状态

完整验证命令：

```powershell
npm run verify
```

Edge 扩展验证命令：

```powershell
npm run verify:edge
```

验证报告默认输出到：

```text
output/verification/verify-report.json
output/verification/ACCEPTANCE.md
```

`output/` 是本地运行产物，不会提交到 GitHub。

## 当前版本定位

当前版本适合个人本地使用，重点是每天节省重复填写、重复整理和重复跟进的时间。后续如果继续扩展，可以优先做：

- 更强的公开岗位数据导入。
- 更细的简历版本管理。
- 更稳定的 ATS 站点规则。
- 更完整的材料生成和面试复盘。
- 更清晰的移动端体验和最终视觉 polish。
