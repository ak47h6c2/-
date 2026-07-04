import type { ApplicationStatus, MarketCode, Sensitivity, SourceType } from "@prisma/client";
import { NextResponse } from "next/server";

const marketCodes = new Set(["AU", "SG", "HK", "CN", "GLOBAL"]);
const sensitivityCodes = new Set(["SAFE", "REVIEW", "SENSITIVE"]);
const sourceTypes = new Set(["MANUAL", "ADZUNA", "ATS", "EMAIL_ALERT", "COMPANY_SITE"]);
const applicationStatuses = new Set([
  "SAVED",
  "PREPARED",
  "APPLIED",
  "OA",
  "INTERVIEW",
  "REJECTED",
  "OFFER",
  "SKIPPED"
]);

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function normalizeMarket(value: unknown, fallback: MarketCode = "GLOBAL"): MarketCode {
  const normalized = String(value || fallback).trim().toUpperCase();
  return marketCodes.has(normalized) ? (normalized as MarketCode) : fallback;
}

export function normalizeSensitivity(value: unknown, fallback: Sensitivity = "REVIEW"): Sensitivity {
  const normalized = String(value || fallback).trim().toUpperCase();
  return sensitivityCodes.has(normalized) ? (normalized as Sensitivity) : fallback;
}

export function normalizeSourceType(value: unknown, fallback: SourceType = "MANUAL"): SourceType {
  const normalized = String(value || fallback).trim().toUpperCase();
  return sourceTypes.has(normalized) ? (normalized as SourceType) : fallback;
}

export function normalizeStatus(value: unknown, fallback: ApplicationStatus = "SAVED"): ApplicationStatus {
  const normalized = String(value || fallback).trim().toUpperCase();
  return applicationStatuses.has(normalized) ? (normalized as ApplicationStatus) : fallback;
}

export function toAutofillSensitivity(value: Sensitivity) {
  return value.toLowerCase() as "safe" | "review" | "sensitive";
}

export function parseOptionalDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function emptyToNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}
