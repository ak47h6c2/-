import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, normalizeMarket, parseOptionalDate } from "@/lib/api-utils";
import { ensureSeedData, makeJobHash } from "@/lib/seed";
import { scoreJob } from "@/lib/job-matching";

type CsvRow = Record<string, string>;

const headerMap: Record<string, string> = {
  market: "market",
  市场: "market",
  company: "company",
  公司: "company",
  title: "title",
  岗位: "title",
  职位: "title",
  location: "location",
  地点: "location",
  城市: "location",
  sourceurl: "sourceUrl",
  url: "sourceUrl",
  链接: "sourceUrl",
  description: "description",
  描述: "description",
  matchscore: "matchScore",
  匹配分: "matchScore",
  postedat: "postedAt",
  发布时间: "postedAt"
};

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(csv: string): CsvRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => {
    const key = header.replace(/\s+/g, "").toLowerCase();
    return headerMap[key] || headerMap[header] || header;
  });

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const contentType = request.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await request.json().catch(() => null) : null;
  const csv = contentType.includes("text/csv") ? await request.text() : body?.csv;
  const rows: CsvRow[] = Array.isArray(body?.items) ? body.items : typeof csv === "string" ? parseCsv(csv) : [];
  const sourceName = String(body?.sourceName || "CSV 导入");

  let source = await prisma.jobSource.findFirst({ where: { name: sourceName } });
  if (!source) {
    source = await prisma.jobSource.create({
      data: {
        name: sourceName,
        market: "GLOBAL",
        sourceType: "MANUAL",
        reliability: 80
      }
    });
  }

  const issues: Array<{ row: number; reason: string; rawText: string }> = [];
  const batch = await prisma.jobImportBatch.create({
    data: {
      sourceId: source.id,
      sourceName,
      importType: "csv",
      rawText: typeof csv === "string" ? csv : null,
      totalCount: rows.length
    }
  });
  const imported = [];
  let skippedCount = 0;
  let importedCount = 0;
  let dedupedCount = 0;

  for (const [index, row] of rows.entries()) {
    if (!row.title || !row.company) {
      skippedCount += 1;
      issues.push({
        row: index + 2,
        reason: "缺少公司或岗位",
        rawText: Object.values(row).filter(Boolean).join(" | ")
      });
      continue;
    }

    const market = normalizeMarket(row.market);
    const sourceHash = makeJobHash({
      market,
      company: row.company,
      title: row.title,
      sourceUrl: emptyToNull(row.sourceUrl)
    });
    const existing = await prisma.job.findFirst({ where: { sourceHash } });
    const scored = scoreJob({
      market,
      title: row.title,
      company: row.company,
      location: emptyToNull(row.location),
      description: emptyToNull(row.description),
      sourceUrl: emptyToNull(row.sourceUrl)
    });
    const data = {
      sourceId: source.id,
      importBatchId: batch.id,
      market,
      title: row.title.trim(),
      company: row.company.trim(),
      location: emptyToNull(row.location),
      sourceUrl: emptyToNull(row.sourceUrl),
      description: row.description || "通过 CSV/平台导入的岗位，待补充描述。",
      language: market === "CN" ? "zh" : "en",
      postedAt: parseOptionalDate(row.postedAt),
      lastSeenAt: new Date(),
      matchScore: row.matchScore ? Number(row.matchScore) : scored.matchScore,
      visaRisk: scored.visaRisk,
      graduateFit: scored.graduateFit,
      sourceHash
    };

    const job = existing
      ? await prisma.job.update({ where: { id: existing.id }, data })
      : await prisma.job.create({ data });

    if (existing) dedupedCount += 1;
    else importedCount += 1;
    imported.push(job);
  }

  const updatedBatch = await prisma.jobImportBatch.update({
    where: { id: batch.id },
    data: {
      issuesJson: JSON.stringify(issues),
      importedCount,
      dedupedCount,
      skippedCount,
      errorCount: skippedCount
    },
    include: { source: true, jobs: true }
  });

  await prisma.sourceSyncLog.create({
    data: {
      sourceId: source.id,
      action: "csv_import",
      status: skippedCount > 0 ? "partial" : "success",
      message: `导入 ${importedCount}，去重 ${dedupedCount}，跳过 ${skippedCount}`
    }
  });

  return NextResponse.json({
    imported: importedCount,
    skipped: skippedCount,
    deduped: dedupedCount,
    batch: updatedBatch,
    jobs: imported
  });
}
