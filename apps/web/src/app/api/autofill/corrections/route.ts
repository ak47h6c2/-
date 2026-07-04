import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.correctedKey) {
    return NextResponse.json({ error: "缺少修正后的字段键。" }, { status: 400 });
  }

  const correction = await prisma.autofillCorrection.create({
    data: {
      runId: body.runId ? String(body.runId) : null,
      formFieldId: body.formFieldId ? String(body.formFieldId) : null,
      mappingRuleId: body.mappingRuleId ? String(body.mappingRuleId) : null,
      previousKey: body.previousKey ? String(body.previousKey).slice(0, 120) : null,
      correctedKey: String(body.correctedKey).slice(0, 120),
      note: body.note ? String(body.note).slice(0, 500) : null
    }
  });

  return NextResponse.json({
    correction: {
      id: correction.id,
      runId: correction.runId,
      formFieldId: correction.formFieldId,
      mappingRuleId: correction.mappingRuleId,
      previousKey: correction.previousKey,
      correctedKey: correction.correctedKey,
      note: correction.note,
      createdAt: correction.createdAt.toISOString()
    }
  });
}
