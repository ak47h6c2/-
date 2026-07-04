import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJobClipboard } from "@/lib/job-import";
import { ensureSeedData, makeJobHash } from "@/lib/seed";

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);
  const text = String(body?.text || body?.rawText || "");
  const sourceName = String(body?.sourceName || "剪贴板导入");

  if (!text.trim()) {
    return NextResponse.json({ error: "请粘贴岗位文本或表格。" }, { status: 400 });
  }

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

  const parsedResult = parseJobClipboard(text);
  const batch = await prisma.jobImportBatch.create({
    data: {
      sourceId: source.id,
      sourceName,
      importType: "clipboard",
      rawText: text,
      issuesJson: JSON.stringify(parsedResult.issues),
      totalCount: parsedResult.total,
      errorCount: parsedResult.errors
    }
  });

  const jobs = [];
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
    jobs.push(job);
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

  await prisma.sourceSyncLog.create({
    data: {
      sourceId: source.id,
      action: "clipboard_import",
      status: parsedResult.errors > 0 ? "partial" : "success",
      message: `导入 ${importedCount}，去重 ${dedupedCount}，跳过 ${skippedCount}`
    }
  });

  return NextResponse.json({ batch: updatedBatch, jobs });
}
