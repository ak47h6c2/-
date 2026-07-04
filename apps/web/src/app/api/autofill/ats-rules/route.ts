import { NextResponse } from "next/server";
import { serializeAtsRules } from "@/lib/ats-rules";

export async function GET() {
  const vendors = serializeAtsRules();

  return NextResponse.json({
    vendors: vendors.map((rule) => ({
      vendor: rule.vendor,
      hostPatterns: rule.hostPatterns,
      candidateKeys: Array.from(new Set(rule.fieldRules.map((fieldRule) => fieldRule.candidateKey))),
      fieldRules: rule.fieldRules
    })),
    updatedAt: new Date().toISOString()
  });
}
