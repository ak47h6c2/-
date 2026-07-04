import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSeedData();
  const { id } = await context.params;
  const draft = await prisma.materialDraft.findUnique({
    where: { id },
    include: { job: true, resumeVersion: true }
  });

  if (!draft) {
    return jsonError("材料草稿不存在。", 404);
  }

  return NextResponse.json({ draft });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSeedData();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const draft = await prisma.materialDraft.update({
    where: { id },
    data: {
      title: body?.title === undefined ? undefined : String(body.title),
      content: body?.content === undefined ? undefined : String(body.content),
      status: body?.status === undefined ? undefined : String(body.status)
    },
    include: { job: true, resumeVersion: true }
  });

  return NextResponse.json({ draft });
}
