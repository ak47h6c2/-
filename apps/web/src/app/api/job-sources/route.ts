import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeMarket, normalizeSourceType } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();
  const sources = await prisma.jobSource.findMany({
    orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { jobs: true, importBatches: true, syncLogs: true } },
      syncLogs: { orderBy: { createdAt: "desc" }, take: 3 }
    }
  });

  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.name) {
    return jsonError("数据源名称不能为空。");
  }

  const source = await prisma.jobSource.create({
    data: {
      name: String(body.name).trim(),
      market: normalizeMarket(body.market),
      sourceType: normalizeSourceType(body.sourceType),
      baseUrl: emptyToNull(body.baseUrl),
      reliability: Math.max(0, Math.min(100, Number(body.reliability ?? 70))),
      enabled: body.enabled ?? true,
      syncLogs: {
        create: {
          action: "create",
          status: "success",
          message: "已创建本地数据源"
        }
      }
    }
  });

  return NextResponse.json({ source });
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return jsonError("数据源 ID 不能为空。");
  }

  const existing = await prisma.jobSource.findUnique({ where: { id: String(body.id) } });
  if (!existing) {
    return jsonError("未找到数据源。", 404);
  }

  const name = body.name === undefined ? existing.name : String(body.name).trim();
  if (!name) {
    return jsonError("数据源名称不能为空。");
  }

  const source = await prisma.jobSource.update({
    where: { id: existing.id },
    data: {
      name,
      market: body.market === undefined ? existing.market : normalizeMarket(body.market, existing.market),
      sourceType: body.sourceType === undefined ? existing.sourceType : normalizeSourceType(body.sourceType, existing.sourceType),
      baseUrl: body.baseUrl === undefined ? existing.baseUrl : emptyToNull(body.baseUrl),
      reliability: body.reliability === undefined ? existing.reliability : Math.max(0, Math.min(100, Number(body.reliability))),
      enabled: body.enabled === undefined ? existing.enabled : Boolean(body.enabled),
      syncLogs: {
        create: {
          action: "update",
          status: "success",
          message: "已更新本地数据源"
        }
      }
    },
    include: {
      _count: { select: { jobs: true, importBatches: true, syncLogs: true } },
      syncLogs: { orderBy: { createdAt: "desc" }, take: 3 }
    }
  });

  return NextResponse.json({ source });
}
