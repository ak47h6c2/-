import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";
import { toAutofillSensitivity } from "@/lib/api-utils";

export async function GET() {
  await ensureSeedData();

  const profile = await prisma.candidateProfile.findFirst({
    orderBy: { updatedAt: "desc" },
    include: { fields: { orderBy: [{ market: "asc" }, { label: "asc" }] } }
  });

  return NextResponse.json({
    updatedAt: profile?.updatedAt.toISOString() ?? new Date().toISOString(),
    profile:
      profile?.fields
        .filter((field) => field.sensitivity !== "SENSITIVE")
        .map((field) => ({
          key: field.key,
          label: field.label,
          value: field.value,
          market: field.market,
          sensitivity: toAutofillSensitivity(field.sensitivity)
        })) ?? []
  });
}
