import { NextResponse } from "next/server";
import { summarizeBackupPayload } from "@/lib/backup";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    return NextResponse.json({ preview: summarizeBackupPayload(payload) });
  } catch {
    return NextResponse.json({
      preview: summarizeBackupPayload(null)
    });
  }
}
