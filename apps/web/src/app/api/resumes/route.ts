import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emptyToNull, jsonError, normalizeMarket } from "@/lib/api-utils";
import { ensureSeedData } from "@/lib/seed";

export async function GET() {
  await ensureSeedData();
  const resumes = await prisma.resumeVersion.findMany({
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: { _count: { select: { materialDrafts: true } } }
  });

  return NextResponse.json({ resumes });
}

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.name || !body?.content) {
    return jsonError("简历名称和内容不能为空。");
  }

  const resume = await prisma.resumeVersion.create({
    data: {
      name: String(body.name).trim(),
      market: body.market ? normalizeMarket(body.market) : null,
      roleFamily: String(body.roleFamily || "通用"),
      language: String(body.language || "zh"),
      content: String(body.content),
      isDefault: Boolean(body.isDefault)
    }
  });

  return NextResponse.json({ resume });
}

export async function PATCH(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);

  if (!body?.id) {
    return jsonError("缺少简历版本 ID。");
  }

  const resume = await prisma.resumeVersion.update({
    where: { id: String(body.id) },
    data: {
      name: body.name === undefined ? undefined : String(body.name).trim(),
      market: body.market === undefined ? undefined : body.market ? normalizeMarket(body.market) : null,
      roleFamily: body.roleFamily === undefined ? undefined : String(body.roleFamily || "通用"),
      language: body.language === undefined ? undefined : String(body.language || "zh"),
      content: body.content === undefined ? undefined : String(body.content),
      isDefault: body.isDefault === undefined ? undefined : Boolean(body.isDefault)
    }
  });

  if (body.isDefault && resume.market) {
    await prisma.resumeVersion.updateMany({
      where: { id: { not: resume.id }, market: resume.market },
      data: { isDefault: false }
    });
  }

  if (body.archive) {
    await prisma.resumeVersion.update({
      where: { id: resume.id },
      data: { content: `${resume.content}\n\n[已归档] ${emptyToNull(body.archiveReason) || "用户标记归档"}` }
    });
  }

  return NextResponse.json({ resume });
}
