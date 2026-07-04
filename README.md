# CareerPilot APAC

CareerPilot APAC is a local-first job search operating system for cross-market IT applications across Australia, Singapore, Hong Kong, Mainland China, and global remote roles.

The first build focuses on the highest-friction workflow:

- Store reusable candidate profile data.
- Use an Edge extension to scan job application forms.
- Fill safe repeated fields without clicking final submit.
- Prepare a daily application sprint.
- Track applications, market feedback, and interview preparation.

## Workspace

```text
apps/web              Next.js local web app
apps/edge-extension   Microsoft Edge autofill assistant
packages/shared       Shared field rules and market types
```

## Local Development

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

The web app runs at `http://localhost:3000`.

For a step-by-step beginner manual in Chinese, use [`docs/BEGINNER_GUIDE.md`](docs/BEGINNER_GUIDE.md). It covers first launch, first-time setup, daily use, Edge extension setup, backups, troubleshooting, and safety boundaries.

For the Chinese local operating guide, use [`docs/LOCAL_USER_GUIDE.md`](docs/LOCAL_USER_GUIDE.md). It covers the daily sprint, CSV file import/export, application packages, Edge setup, backups, verification, and the automation boundaries.

For the current completion evidence and remaining boundaries, use [`docs/PROJECT_COMPLETION_AUDIT.md`](docs/PROJECT_COMPLETION_AUDIT.md).

## Job Data Import

The `数据源` page supports CSV files, CSV/table text, structured job blocks, one-line platform alerts, and email/job-alert snippets. Good inputs include:

- `公司 / 岗位 / 地点 / 链接 / 描述` blocks.
- Rows like `Software Engineer Intern | Shopee | Singapore | https://...`.
- Email snippets where the job title, company, location, and `View job` link appear on nearby lines.
- CSV files with headers such as `市场,公司,岗位,地点,链接,描述,匹配分,发布时间`.
- Public source URLs that you configure yourself, such as company career pages, public ATS lists, or job-alert links.

Imports are local-first and deduplicated by source URL or generated `sourceHash`. The parser records unresolved fragments in the import batch so they can be fixed manually instead of silently disappearing.
CSV imports show total, newly imported, deduped, and skipped counts in the UI.
Public source sync only fetches configured `http/https` pages. It does not use login sessions, bypass access controls, solve CAPTCHA, or submit applications.
The `今日打卡` page also exposes `每日岗位刷新`, so the daily flow can refresh configured public sources before generating the shortlist.

## Edge Extension

Load `apps/edge-extension` as an unpacked extension in Microsoft Edge:

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select the `apps/edge-extension` folder.

The extension only fills safe fields and never clicks final submit.

Recommended real-use flow:

1. In the Web app, open `投递包` and click `设为当前 Edge 申请`.
2. Open the official application page in Edge.
3. Open the CareerPilot extension. The popup shows the currently bound company/job and whether the current page domain matches.
4. Click `保存表单快照` or `填写安全字段`. The extension passes the bound application ID to the local API, so snapshots and fill runs are attached to the right `投递包`.
5. In the Web app, use `当前快照回放` or the package `绑定快照回放` to export a Markdown checklist of fields that are safe to fill, need manual review, or still need mapping/value fixes.

## Local Backup

The `本地备份` page can export a CareerPilot APAC JSON snapshot and restore it later.

- Export: `GET /api/backup/export`
- Preview before restore: `POST /api/backup/preview`
- Merge restore: `POST /api/backup/import`

Restore is intentionally merge-only. Matching IDs are updated, new IDs are inserted, and existing local records are not deleted.

## Verification

Run the full local verification from the workspace root:

```bash
npm run verify
```

This runs design-system checks, typecheck, lint, build, starts or reuses the local web app, and runs desktop/mobile visual smoke.
It also runs a non-destructive API smoke pass against the local app: profile, autofill profile, jobs, applications, daily plan, sources, resumes, materials, snapshots, package read, job parsing, backup export, backup preview, and merge restore cleanup.

The verification report is written to `output/verification/verify-report.json`.
The report keeps structured summaries from design-system, API smoke, and visual smoke steps, so you can review counts, screenshots, overflow checks, accessibility checks, and runtime API coverage after the command finishes.
The human-readable acceptance summary is written to `output/verification/ACCEPTANCE.md`.

For a static-only pass without browser runtime checks:

```bash
npm run verify:static
```

Run individual checks when debugging a specific failure:

```bash
npm run design:check -w @careerpilot/web
npm run typecheck
npm run lint
npm run build
npm run api:smoke -w @careerpilot/web
npm run visual:smoke -w @careerpilot/web
npm run smoke:cleanup -w @careerpilot/web
```

Runtime smoke tests use explicit `__careerpilot_smoke_*` source names and test URLs. `api:smoke`, `visual:smoke`, and `verify` clean those records automatically. If a run is interrupted, `npm run smoke:cleanup -w @careerpilot/web` removes leftover smoke jobs, batches, sync logs, and sources without touching ordinary user records.

The Web design-system source is in `apps/web/design-system/careerpilot-apac.design-system.json`. It maps code tokens and component classes, including global search, to Figma-ready names for the CareerPilot APAC component library. The local preview page is available at `http://localhost:3000/design-system`, and the Figma handoff plan is in `apps/web/design-system/FIGMA_HANDOFF.md`.

Regenerate the Figma Plugin API handoff script after design-system changes:

```bash
npm run figma:export -w @careerpilot/web
```

Run the Edge extension checks:

```bash
npm run build -w @careerpilot/edge-extension
npm run smoke -w @careerpilot/edge-extension
npm run verify:edge
```

The extension smoke test launches Edge or Chromium, loads the unpacked extension, opens the local ATS Lab, and verifies Workday, Greenhouse, Lever, SmartRecruiters, Ashby, BambooHR, and generic company forms. It scans each form, saves a form snapshot, fills safe fields, skips review/sensitive/file fields, keeps hidden fields untouched, then cleans up test snapshots.

To run one scenario while debugging:

```powershell
$env:CAREERPILOT_ATS_TYPE="workday"
npm run smoke -w @careerpilot/edge-extension
Remove-Item Env:CAREERPILOT_ATS_TYPE
```
