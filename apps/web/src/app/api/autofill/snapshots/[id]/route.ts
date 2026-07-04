import { NextResponse } from "next/server";
import { serializeFormSnapshot } from "@/lib/autofill-workbench";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  await ensureSeedData();
  const { id } = await context.params;

  const snapshot = await prisma.formSnapshot.findUnique({
    where: { id },
    include: { fields: { orderBy: [{ required: "desc" }, { confidence: "desc" }, { createdAt: "asc" }] } }
  });

  if (!snapshot) {
    return NextResponse.json({ error: "没有找到表单快照。" }, { status: 404 });
  }

  return NextResponse.json({ snapshot: serializeFormSnapshot(snapshot) });
}

export async function PATCH(request: Request, context: RouteContext) {
  await ensureSeedData();
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const snapshot = await prisma.formSnapshot.update({
    where: { id },
    data: {
      title: body?.title === undefined ? undefined : String(body.title).slice(0, 240),
      atsVendor: body?.atsVendor === undefined ? undefined : String(body.atsVendor).slice(0, 120),
      applicationId: body?.applicationId === undefined ? undefined : body.applicationId ? String(body.applicationId) : null
    },
    include: { fields: { orderBy: [{ required: "desc" }, { confidence: "desc" }, { createdAt: "asc" }] } }
  });

  return NextResponse.json({ snapshot: serializeFormSnapshot(snapshot) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await ensureSeedData();
  const { id } = await context.params;

  const existing = await prisma.formSnapshot.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existing) {
    return NextResponse.json({ deleted: false });
  }

  await prisma.autofillRun.updateMany({
    where: { snapshotId: id },
    data: { snapshotId: null }
  });
  await prisma.formSnapshot.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
