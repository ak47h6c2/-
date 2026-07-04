import { NextResponse } from "next/server";
import { sensitivityFromClient } from "@/lib/autofill-workbench";
import { emptyToNull, toAutofillSensitivity } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

function serializeRule(rule: Awaited<ReturnType<typeof prisma.fieldMappingRule.findMany>>[number]) {
  return {
    id: rule.id,
    formFieldId: rule.formFieldId,
    host: rule.host,
    atsVendor: rule.atsVendor,
    fieldFingerprint: rule.fieldFingerprint,
    labelPattern: rule.labelPattern,
    inputName: rule.inputName,
    candidateKey: rule.candidateKey,
    sensitivity: toAutofillSensitivity(rule.sensitivity),
    confidence: rule.confidence,
    enabled: rule.enabled,
    source: rule.source,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString()
  };
}

export async function GET(request: Request) {
  await ensureSeedData();
  const { searchParams } = new URL(request.url);
  const host = searchParams.get("host")?.toLowerCase() || null;
  const atsVendor = searchParams.get("atsVendor") || null;
  const includeDisabled = searchParams.get("includeDisabled") === "1";

  const rules = await prisma.fieldMappingRule.findMany({
    where: {
      enabled: includeDisabled ? undefined : true,
      AND: [
        host ? { OR: [{ host: null }, { host }, { host: { contains: host } }] } : {},
        atsVendor ? { OR: [{ atsVendor: null }, { atsVendor }] } : {}
      ]
    },
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: 200
  });

  return NextResponse.json({ rules: rules.map(serializeRule) });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.candidateKey) {
    return NextResponse.json({ error: "缺少候选人资料字段。" }, { status: 400 });
  }

  const formField = body.formFieldId
    ? await prisma.formField.findUnique({
        where: { id: String(body.formFieldId) },
        include: { snapshot: true }
      })
    : null;

  const candidateKey = String(body.candidateKey).slice(0, 120);
  const previousKey = formField?.mappedKey ?? formField?.detectedKey ?? null;

  const rule = await prisma.fieldMappingRule.create({
    data: {
      formFieldId: formField?.id ?? null,
      host: emptyToNull(body.host) ?? formField?.snapshot.host ?? null,
      atsVendor: emptyToNull(body.atsVendor) ?? formField?.snapshot.atsVendor ?? null,
      fieldFingerprint: emptyToNull(body.fieldFingerprint) ?? formField?.fieldFingerprint ?? null,
      labelPattern: String(body.labelPattern ?? formField?.label ?? "").slice(0, 500),
      inputName: emptyToNull(body.inputName) ?? formField?.inputName ?? null,
      candidateKey,
      sensitivity: sensitivityFromClient(body.sensitivity, formField?.sensitivity ?? "SAFE"),
      confidence: Math.max(0, Math.min(100, Number(body.confidence ?? 92))),
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
      source: String(body.source || "manual").slice(0, 80)
    }
  });

  if (formField) {
    await prisma.formField.update({
      where: { id: formField.id },
      data: {
        mappedKey: candidateKey,
        sensitivity: sensitivityFromClient(body.sensitivity, formField.sensitivity)
      }
    });

    if (previousKey !== candidateKey) {
      await prisma.autofillCorrection.create({
        data: {
          formFieldId: formField.id,
          mappingRuleId: rule.id,
          previousKey,
          correctedKey: candidateKey,
          note: "用户在填表资料库保存字段映射"
        }
      });
    }
  }

  return NextResponse.json({ rule: serializeRule(rule) }, { status: 201 });
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return NextResponse.json({ error: "缺少映射规则 ID。" }, { status: 400 });
  }

  const existing = await prisma.fieldMappingRule.findUnique({
    where: { id: String(body.id) },
    include: { formField: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "没有找到映射规则。" }, { status: 404 });
  }

  const nextCandidateKey = body.candidateKey === undefined ? existing.candidateKey : String(body.candidateKey).slice(0, 120);
  const nextSensitivity = body.sensitivity === undefined ? existing.sensitivity : sensitivityFromClient(body.sensitivity);

  const rule = await prisma.fieldMappingRule.update({
    where: { id: String(body.id) },
    data: {
      candidateKey: body.candidateKey === undefined ? undefined : nextCandidateKey,
      labelPattern: body.labelPattern === undefined ? undefined : String(body.labelPattern).slice(0, 500),
      inputName: body.inputName === undefined ? undefined : emptyToNull(body.inputName),
      sensitivity: body.sensitivity === undefined ? undefined : nextSensitivity,
      confidence: body.confidence === undefined ? undefined : Math.max(0, Math.min(100, Number(body.confidence))),
      enabled: body.enabled === undefined ? undefined : Boolean(body.enabled)
    }
  });

  if (existing.formField && (existing.candidateKey !== nextCandidateKey || existing.sensitivity !== nextSensitivity)) {
    await prisma.formField.update({
      where: { id: existing.formField.id },
      data: {
        mappedKey: nextCandidateKey,
        sensitivity: nextSensitivity
      }
    });

    await prisma.autofillCorrection.create({
      data: {
        formFieldId: existing.formField.id,
        mappingRuleId: rule.id,
        previousKey: existing.candidateKey,
        correctedKey: nextCandidateKey,
        note: "用户修改已保存映射规则"
      }
    });
  }

  return NextResponse.json({ rule: serializeRule(rule) });
}
