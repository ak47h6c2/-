import { NextResponse } from "next/server";
import { applyAtsRulesToFields, detectAtsVendor } from "@/lib/ats-rules";
import { hostFromUrl, normalizeFormField, serializeFormSnapshot } from "@/lib/autofill-workbench";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.url) {
    return NextResponse.json({ error: "缺少表单页面 URL。" }, { status: 400 });
  }

  const url = String(body.url);
  const host = hostFromUrl(url);
  const atsVendor = body.atsVendor ? String(body.atsVendor) : detectAtsVendor(url, host, body.title ?? body.schema?.title);
  const fields = applyAtsRulesToFields(Array.isArray(body.fields) ? body.fields.slice(0, 120) : [], atsVendor);
  const shouldPersistSnapshot = Boolean(body.persistSnapshot || body.eventType === "snapshot" || body.schema);

  const snapshot = shouldPersistSnapshot
    ? await prisma.formSnapshot.create({
        data: {
          url,
          applicationId: body.applicationId ? String(body.applicationId) : null,
          host,
          title: body.title ? String(body.title).slice(0, 240) : body.schema?.title ? String(body.schema.title).slice(0, 240) : null,
          atsVendor,
          source: "EDGE",
          fieldCount: fields.length,
          safeCount: fields.filter((field: Record<string, unknown>) => String(field.sensitivity).toLowerCase() === "safe").length,
          reviewCount: fields.filter((field: Record<string, unknown>) => String(field.sensitivity).toLowerCase() === "review").length,
          fields: {
            create: fields.map((field: Record<string, unknown>) => normalizeFormField(field, host, atsVendor))
          }
        },
        include: { fields: { orderBy: { createdAt: "asc" } } }
      })
    : null;

  const run = await prisma.autofillRun.create({
    data: {
      applicationId: body.applicationId || null,
      snapshotId: snapshot?.id ?? null,
      url,
      atsVendor,
      mode: String(body.eventType || body.mode || "scan"),
      fieldsDetected: Number(body.fieldsDetected ?? body.detected ?? fields.length ?? 0),
      fieldsFilled: Number(body.fieldsFilled ?? body.filled ?? 0),
      fieldsSkipped: Number(body.fieldsSkipped ?? body.skipped ?? 0),
      snapshots: {
        create: fields.slice(0, 80).map((field: Record<string, unknown>) => ({
          url,
          label: String(field.labelText ?? field.label ?? ""),
          inputName: field.inputName ? String(field.inputName) : null,
          inputType: field.inputType ? String(field.inputType) : null,
          detectedKey: field.key ? String(field.key) : null,
          confidence: Number(field.confidence ?? 70)
        }))
      }
    },
    include: { snapshots: true }
  });

  return NextResponse.json({ run, snapshot: snapshot ? serializeFormSnapshot(snapshot) : null });
}
