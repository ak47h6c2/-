import { NextResponse } from "next/server";
import { applyAtsRulesToFields, detectAtsVendor } from "@/lib/ats-rules";
import { hostFromUrl, normalizeFormField, serializeFormSnapshot } from "@/lib/autofill-workbench";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();

  const snapshots = await prisma.formSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { fields: { orderBy: [{ required: "desc" }, { confidence: "desc" }, { createdAt: "asc" }] } }
  });

  return NextResponse.json({ snapshots: snapshots.map(serializeFormSnapshot) });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.url) {
    return NextResponse.json({ error: "缺少表单页面 URL。" }, { status: 400 });
  }

  const url = String(body.url);
  const host = hostFromUrl(url);
  const atsVendor = body.atsVendor ? String(body.atsVendor) : detectAtsVendor(url, host, body.title);
  const fields = applyAtsRulesToFields(Array.isArray(body.fields) ? body.fields.slice(0, 160) : [], atsVendor);

  const snapshot = await prisma.formSnapshot.create({
    data: {
      url,
      applicationId: body.applicationId ? String(body.applicationId) : null,
      host,
      title: body.title ? String(body.title).slice(0, 240) : null,
      atsVendor,
      source: String(body.source || "WEB"),
      fieldCount: fields.length,
      safeCount: fields.filter((field: Record<string, unknown>) => String(field.sensitivity).toLowerCase() === "safe").length,
      reviewCount: fields.filter((field: Record<string, unknown>) => String(field.sensitivity).toLowerCase() === "review").length,
      fields: {
        create: fields.map((field: Record<string, unknown>) => normalizeFormField(field, host, atsVendor))
      }
    },
    include: { fields: { orderBy: { createdAt: "asc" } } }
  });

  return NextResponse.json({ snapshot: serializeFormSnapshot(snapshot) }, { status: 201 });
}
