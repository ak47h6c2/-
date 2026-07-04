# CareerPilot APAC Figma Handoff

## Current Source Of Truth

- Tokens and component spec: `apps/web/design-system/careerpilot-apac.design-system.json`
- Generated Figma Plugin API script: `apps/web/design-system/generated/careerpilot-figma-library.use-figma.js`
- Visual preview: `http://localhost:3000/design-system`
- Implementation CSS: `apps/web/src/app/globals.css`
- Verification:
  - `npm run figma:export -w @careerpilot/web`
  - `npm run design:check -w @careerpilot/web`
  - `npm run visual:smoke -w @careerpilot/web`

## Figma Library Scope

Create a Figma design library named `CareerPilot APAC Design System`.

Pages:

1. `Cover`
2. `Getting Started`
3. `Foundations / Colors`
4. `Foundations / Typography`
5. `Foundations / Spacing + Radius`
6. `Components / Navigation`
7. `Components / Workflow`
8. `Components / Local Status`
9. `Components / Search`
10. `Components / Surfaces`
11. `Components / Actions`
12. `Components / Forms`
13. `Components / Data Cards`
14. `Components / Source Sync`
15. `Components / Daily Source Refresh`
16. `Components / Status Chips`
17. `Components / Feedback`
18. `Components / ATS Lab`
19. `Components / Autofill Mapping`
20. `Components / Snapshot Replay`
21. `Components / Pipeline Review`

Variables:

- Create primitive values from the JSON `tokens` groups.
- Create semantic variables with the `figmaName` values.
- Set Web code syntax to the matching CSS variable, for example `var(--color-accent-default)`.
- Set scopes explicitly: fills, text fills, strokes, gap, corner radius, and effect usage.

Components:

- `CareerPilot/Nav Rail`
- `CareerPilot/Workbench Header`
- `CareerPilot/Workflow Ribbon`
- `CareerPilot/Local Run Status`
- `CareerPilot/Global Search`
- `CareerPilot/Panel`
- `CareerPilot/Button`
- `CareerPilot/Form Field`
- `CareerPilot/Data Card`
- `CareerPilot/Source Sync`
- `CareerPilot/Daily Source Refresh`
- `CareerPilot/Status Chip`
- `CareerPilot/Empty State`
- `CareerPilot/ATS Lab`
- `CareerPilot/Mapping Learning`
- `CareerPilot/Snapshot Replay`
- `CareerPilot/Pipeline Review`

本地运行状态组件说明:

- `CareerPilot/Local Run Status` 桌面端采用两层结构：第一层展示摘要和复制动作，第二层展示五张运行状态卡。
- 移动端采用单列摘要和横向状态卡带，降低首屏高度。
- 复制动作只导出 Markdown 状态记录，不代表自动投递或自动提交。

## Connector Status

Figma MCP connector 已可用。本轮已同步代码侧 0.6.0 设计系统更新:

- File: `CareerPilot APAC Design System 0.6.0`
- URL: `https://www.figma.com/design/th3k16oNdYatOFTUAfdbqc`
- File key: `th3k16oNdYatOFTUAfdbqc`
- Plan: `batman`
- Synced scope: 3 个变量集合、35 个 token、5 个文字样式、2 个阴影样式、17 个可编辑 Figma Component 规格卡；本轮新增 `export-button` 导出按钮变体、移动端动作区两列排布、`motion/action-stagger` 动效说明，以及 CSV 导出真实下载质量门。

后续继续使用 `figma-generate-library` + `figma-use` 工作流:

1. Inspect the target file.
2. Search available libraries.
3. Refine one component at a time into proper variants and component properties.
4. Validate the generated pages, variables, styles, and components.
5. Capture Figma screenshots for QA.

Generated Plugin API script:

```text
apps/web/design-system/generated/careerpilot-figma-library.use-figma.js
```

Pass `skillNames` as:

```text
figma-use,figma-generate-library
```

## Capture Path

The local visual preview can be pushed into an existing Figma design file with `generate_figma_design` using:

```text
http://localhost:3000/design-system
```

This capture should be used only as visual reference. The editable library should still be built from variables and components via `use_figma`.
