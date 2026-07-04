import { NextResponse } from "next/server";
import type { JobSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseJobClipboard } from "@/lib/job-import";
import { ensureSeedData, makeJobHash } from "@/lib/seed";

type SyncResult = {
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      const code = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (normalized.startsWith("#")) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[normalized] ?? match;
  });
}

function absoluteUrl(rawHref: string, baseUrl: string) {
  try {
    return new URL(rawHref, baseUrl).toString();
  } catch {
    return "";
  }
}

function htmlToJobText(html: string, baseUrl: string) {
  const cleaned = cleanText(html);
  const lines: string[] = [];
  const title = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description = cleaned.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1];

  if (title) lines.push(decodeHtmlEntities(title.replace(/<[^>]+>/g, " ")));
  if (description) lines.push(decodeHtmlEntities(description));

  const headingMatches = cleaned.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  for (const match of headingMatches) {
    const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text) lines.push(text);
  }

  const anchorMatches = cleaned.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of anchorMatches) {
    const attrs = match[1];
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    const url = absoluteUrl(href, baseUrl);
    if (!url) continue;
    const label = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const hrefLooksUseful = /job|career|position|apply|opening|requisition|岗位|职位|校招|实习/i.test(`${href} ${label}`);
    if (hrefLooksUseful) {
      lines.push(`${label || "岗位链接"} | ${url}`);
    }
  }

  const bodyText = decodeHtmlEntities(
    cleaned
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|section|article|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 260)
      .join("\n")
  );

  if (bodyText) lines.push(bodyText);
  return Array.from(new Set(lines.map((line) => line.trim()).filter(Boolean))).join("\n").slice(0, 180_000);
}

async function fetchSourceText(source: JobSource) {
  if (!source.baseUrl) {
    throw new Error("数据源缺少 URL。");
  }

  const url = new URL(source.baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("只支持 http/https 公开页面。");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html, text/plain;q=0.9, */*;q=0.5",
        "user-agent": "CareerPilot APAC local job-source sync"
      }
    });

    if (!response.ok) {
      throw new Error(`公开页面返回 ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = (await response.text()).slice(0, 1_000_000);

    if (contentType.includes("html") || /<html|<a\b|<body/i.test(text)) {
      return htmlToJobText(text, response.url || source.baseUrl);
    }

    return text.slice(0, 180_000);
  } finally {
    clearTimeout(timer);
  }
}

async function importParsedJobs(source: JobSource, rawText: string) {
  const parsedResult = parseJobClipboard(rawText);
  const batch = await prisma.jobImportBatch.create({
    data: {
      sourceId: source.id,
      sourceName: source.name,
      importType: "source_sync",
      rawText,
      issuesJson: JSON.stringify(parsedResult.issues),
      totalCount: parsedResult.total,
      errorCount: parsedResult.errors
    }
  });

  let importedCount = 0;
  let dedupedCount = 0;
  const skippedCount = parsedResult.errors;

  for (const parsed of parsedResult.parsed) {
    const sourceHash = makeJobHash(parsed);
    const existing = await prisma.job.findFirst({ where: { sourceHash } });
    const data = {
      sourceId: source.id,
      importBatchId: batch.id,
      market: parsed.market,
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      sourceUrl: parsed.sourceUrl,
      description: parsed.description,
      language: parsed.market === "CN" ? "zh" : "en",
      postedAt: parsed.postedAt,
      lastSeenAt: new Date(),
      matchScore: parsed.matchScore,
      visaRisk: parsed.visaRisk,
      graduateFit: parsed.graduateFit,
      sourceHash
    };

    const job = existing
      ? await prisma.job.update({ where: { id: existing.id }, data })
      : await prisma.job.create({ data });

    await prisma.jobParseResult.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        rawText: parsed.rawText,
        keywordsJson: JSON.stringify(parsed.keywords),
        positiveReasonsJson: JSON.stringify(parsed.positiveReasons),
        negativeReasonsJson: JSON.stringify(parsed.negativeReasons),
        riskSignalsJson: JSON.stringify(parsed.riskSignals),
        deadline: parsed.deadline,
        confidence: parsed.confidence
      },
      update: {
        rawText: parsed.rawText,
        keywordsJson: JSON.stringify(parsed.keywords),
        positiveReasonsJson: JSON.stringify(parsed.positiveReasons),
        negativeReasonsJson: JSON.stringify(parsed.negativeReasons),
        riskSignalsJson: JSON.stringify(parsed.riskSignals),
        deadline: parsed.deadline,
        confidence: parsed.confidence
      }
    });

    if (existing) dedupedCount += 1;
    else importedCount += 1;
  }

  const updatedBatch = await prisma.jobImportBatch.update({
    where: { id: batch.id },
    data: {
      importedCount,
      dedupedCount,
      skippedCount,
      errorCount: parsedResult.errors
    },
    include: { source: true, jobs: true }
  });

  return {
    batch: updatedBatch,
    importedCount,
    dedupedCount,
    skippedCount,
    errors: parsedResult.errors,
    total: parsedResult.total
  };
}

async function syncOneSource(source: JobSource): Promise<SyncResult> {
  if (!source.enabled) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: "skipped",
      imported: 0,
      deduped: 0,
      skipped: 0,
      errors: 0,
      total: 0,
      extractedChars: 0,
      message: "数据源已暂停"
    };
  }

  if (!source.baseUrl) {
    await prisma.sourceSyncLog.create({
      data: {
        sourceId: source.id,
        action: "source_sync",
        status: "failed",
        message: "缺少公开 URL"
      }
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      status: "failed",
      imported: 0,
      deduped: 0,
      skipped: 0,
      errors: 1,
      total: 0,
      extractedChars: 0,
      message: "缺少公开 URL"
    };
  }

  try {
    const rawText = await fetchSourceText(source);
    const imported = await importParsedJobs(source, rawText);
    const status = imported.errors > 0 ? "partial" : "success";
    const message = `同步 ${imported.total} 条，新增 ${imported.importedCount}，去重 ${imported.dedupedCount}，跳过 ${imported.skippedCount}`;

    await prisma.jobSource.update({
      where: { id: source.id },
      data: {
        lastSyncedAt: new Date(),
        syncLogs: {
          create: {
            action: "source_sync",
            status,
            message
          }
        }
      }
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      status,
      imported: imported.importedCount,
      deduped: imported.dedupedCount,
      skipped: imported.skippedCount,
      errors: imported.errors,
      total: imported.total,
      extractedChars: rawText.length,
      batchId: imported.batch.id,
      message
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同步失败";
    await prisma.sourceSyncLog.create({
      data: {
        sourceId: source.id,
        action: "source_sync",
        status: "failed",
        message
      }
    });

    return {
      sourceId: source.id,
      sourceName: source.name,
      status: "failed",
      imported: 0,
      deduped: 0,
      skipped: 0,
      errors: 1,
      total: 0,
      extractedChars: 0,
      message
    };
  }
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);
  const sourceId = body?.sourceId ? String(body.sourceId) : null;
  const limit = Math.max(1, Math.min(8, Number(body?.limit ?? 5)));

  const sources = sourceId
    ? await prisma.jobSource.findMany({ where: { id: sourceId } })
    : await prisma.jobSource.findMany({
        where: {
          enabled: true,
          baseUrl: { not: null },
          sourceType: { in: ["COMPANY_SITE", "ATS", "EMAIL_ALERT", "ADZUNA"] }
        },
        orderBy: [{ lastSyncedAt: "asc" }, { createdAt: "desc" }],
        take: limit
      });

  if (sourceId && !sources.length) {
    return jsonError("未找到数据源。", 404);
  }

  if (!sources.length) {
    return NextResponse.json({
      results: [],
      totals: { imported: 0, deduped: 0, skipped: 0, errors: 0, total: 0 },
      message: "没有可同步的启用公开来源。"
    });
  }

  const results: SyncResult[] = [];
  for (const source of sources) {
    results.push(await syncOneSource(source));
  }

  const totals = results.reduce(
    (sum, item) => ({
      imported: sum.imported + item.imported,
      deduped: sum.deduped + item.deduped,
      skipped: sum.skipped + item.skipped,
      errors: sum.errors + item.errors,
      total: sum.total + item.total
    }),
    { imported: 0, deduped: 0, skipped: 0, errors: 0, total: 0 }
  );

  return NextResponse.json({
    results,
    totals,
    message: `公开来源同步完成：新增 ${totals.imported}，去重 ${totals.deduped}，跳过/失败 ${totals.skipped + totals.errors}`
  });
}
