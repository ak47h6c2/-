import { NextResponse } from "next/server";
import { parseJobClipboard } from "@/lib/job-import";
import { ensureSeedData } from "@/lib/seed";

export async function POST(request: Request) {
  await ensureSeedData();
  const body = await request.json().catch(() => null);
  const text = String(body?.text || body?.rawText || "");

  if (!text.trim()) {
    return NextResponse.json({ error: "请粘贴岗位文本或表格。" }, { status: 400 });
  }

  const result = parseJobClipboard(text);
  return NextResponse.json(result);
}
