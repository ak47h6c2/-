import { NextResponse } from "next/server";
import { importBackupPayload } from "@/lib/backup";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const result = await importBackupPayload(payload.backup ?? payload);

    return NextResponse.json({ result }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "备份导入失败"
      },
      { status: 400 }
    );
  }
}
