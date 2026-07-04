import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();
  const batches = await prisma.jobImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { source: true, jobs: { take: 5, orderBy: { matchScore: "desc" } } },
    take: 20
  });

  return NextResponse.json({ batches });
}
