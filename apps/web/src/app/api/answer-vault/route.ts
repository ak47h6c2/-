import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeMarket, normalizeSensitivity } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();
  const items = await prisma.answerVaultItem.findMany({
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.question || !body?.answer) {
    return jsonError("问题和答案不能为空。");
  }

  const item = await prisma.answerVaultItem.create({
    data: {
      question: String(body.question).trim(),
      answer: String(body.answer).trim(),
      market: body.market ? normalizeMarket(body.market) : null,
      roleFamily: emptyToNull(body.roleFamily),
      sensitivity: normalizeSensitivity(body.sensitivity)
    }
  });

  return NextResponse.json({ item });
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return jsonError("缺少题库记录 ID。");
  }

  const item = await prisma.answerVaultItem.update({
    where: { id: String(body.id) },
    data: {
      question: body.question === undefined ? undefined : String(body.question).trim(),
      answer: body.answer === undefined ? undefined : String(body.answer).trim(),
      market: body.market === undefined ? undefined : body.market ? normalizeMarket(body.market) : null,
      roleFamily: body.roleFamily === undefined ? undefined : emptyToNull(body.roleFamily),
      sensitivity: body.sensitivity === undefined ? undefined : normalizeSensitivity(body.sensitivity)
    }
  });

  return NextResponse.json({ item });
}
