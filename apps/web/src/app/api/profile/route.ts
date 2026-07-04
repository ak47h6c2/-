import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeMarket, normalizeSensitivity, toAutofillSensitivity } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

function serializeProfile(profile: Awaited<ReturnType<typeof getProfile>>) {
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    headline: profile.headline,
    updatedAt: profile.updatedAt.toISOString(),
    fields: profile.fields.map((field) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      value: field.value,
      market: field.market,
      sensitivity: toAutofillSensitivity(field.sensitivity)
    }))
  };
}

async function getProfile() {
  return prisma.candidateProfile.findFirst({
    orderBy: { updatedAt: "desc" },
    include: { fields: { orderBy: [{ market: "asc" }, { label: "asc" }] } }
  });
}

export async function GET() {
  await ensureSeedData();
  return NextResponse.json({ profile: serializeProfile(await getProfile()) });
}

export async function PUT(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body) {
    return jsonError("请求体不是有效 JSON。");
  }

  const existing = await getProfile();
  const fields = Array.isArray(body.fields) ? body.fields : [];
  const profile = await prisma.candidateProfile.upsert({
    where: { id: existing?.id ?? "__missing__" },
    create: {
      name: String(body.name || "我的求职资料"),
      headline: emptyToNull(body.headline),
      fields: {
        create: fields.map((field: Record<string, unknown>) => ({
          key: String(field.key || "").trim(),
          label: String(field.label || field.key || "").trim(),
          value: String(field.value ?? ""),
          market: field.market ? normalizeMarket(field.market) : null,
          sensitivity: normalizeSensitivity(field.sensitivity)
        }))
      }
    },
    update: {
      name: String(body.name || existing?.name || "我的求职资料"),
      headline: emptyToNull(body.headline),
      fields: {
        deleteMany: {},
        create: fields
          .filter((field: Record<string, unknown>) => String(field.key || "").trim())
          .map((field: Record<string, unknown>) => ({
            key: String(field.key || "").trim(),
            label: String(field.label || field.key || "").trim(),
            value: String(field.value ?? ""),
            market: field.market ? normalizeMarket(field.market) : null,
            sensitivity: normalizeSensitivity(field.sensitivity)
          }))
      }
    },
    include: { fields: { orderBy: [{ market: "asc" }, { label: "asc" }] } }
  });

  return NextResponse.json({ profile: serializeProfile(profile) });
}
