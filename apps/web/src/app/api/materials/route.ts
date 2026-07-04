import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();
  const drafts = await prisma.materialDraft.findMany({
    orderBy: { updatedAt: "desc" },
    include: { job: true, resumeVersion: true },
    take: 100
  });

  return NextResponse.json({ drafts });
}
