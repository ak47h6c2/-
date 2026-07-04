import { createHash } from "crypto";
import type { FormField, FormSnapshot, Prisma, Sensitivity } from "@prisma/client";
import { normalizeSensitivity, toAutofillSensitivity } from "./api-utils";

type RawField = Record<string, unknown>;

export function hostFromUrl(value: unknown) {
  try {
    return new URL(String(value || "")).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function stableFieldFingerprint(field: RawField, host?: string | null, atsVendor?: string | null) {
  const source = [
    host || "",
    atsVendor || "",
    field.fieldFingerprint,
    field.inputName,
    field.inputId,
    field.inputType,
    field.placeholder,
    field.labelText ?? field.label,
    field.selector
  ]
    .map((item) => String(item || "").trim().toLowerCase())
    .join("|");

  return createHash("sha1").update(source).digest("hex").slice(0, 18);
}

export function normalizeFormField(field: RawField, host?: string | null, atsVendor?: string | null): Prisma.FormFieldCreateWithoutSnapshotInput {
  const sensitivity = normalizeSensitivity(field.sensitivity, field.key ? "SAFE" : "REVIEW");
  const label = String(field.labelText ?? field.label ?? field.placeholder ?? field.inputName ?? "未命名字段").slice(0, 500);
  const options = Array.isArray(field.options) ? field.options.slice(0, 40) : null;

  return {
    fieldFingerprint: stableFieldFingerprint(field, host, atsVendor),
    label,
    inputName: field.inputName ? String(field.inputName).slice(0, 240) : null,
    inputId: field.inputId ? String(field.inputId).slice(0, 240) : null,
    inputType: field.inputType ? String(field.inputType).slice(0, 80) : null,
    placeholder: field.placeholder ? String(field.placeholder).slice(0, 300) : null,
    required: Boolean(field.required),
    detectedKey: field.key ? String(field.key).slice(0, 120) : null,
    mappedKey: field.mappedKey ? String(field.mappedKey).slice(0, 120) : field.key ? String(field.key).slice(0, 120) : null,
    sensitivity,
    confidence: Math.max(0, Math.min(100, Number(field.confidence ?? 0))),
    selector: field.selector ? String(field.selector).slice(0, 500) : null,
    optionsJson: options ? JSON.stringify(options) : null
  };
}

export function serializeFormField(field: FormField) {
  return {
    id: field.id,
    snapshotId: field.snapshotId,
    fieldFingerprint: field.fieldFingerprint,
    label: field.label,
    inputName: field.inputName,
    inputId: field.inputId,
    inputType: field.inputType,
    placeholder: field.placeholder,
    required: field.required,
    detectedKey: field.detectedKey,
    mappedKey: field.mappedKey,
    sensitivity: toAutofillSensitivity(field.sensitivity),
    confidence: field.confidence,
    selector: field.selector,
    options: field.optionsJson ? safeJsonParse(field.optionsJson, []) : [],
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString()
  };
}

export function serializeFormSnapshot(snapshot: FormSnapshot & { fields?: FormField[] }) {
  return {
    id: snapshot.id,
    applicationId: snapshot.applicationId,
    url: snapshot.url,
    host: snapshot.host,
    title: snapshot.title,
    atsVendor: snapshot.atsVendor,
    source: snapshot.source,
    fieldCount: snapshot.fieldCount,
    safeCount: snapshot.safeCount,
    reviewCount: snapshot.reviewCount,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
    fields: snapshot.fields?.map(serializeFormField) ?? []
  };
}

export function sensitivityFromClient(value: unknown, fallback: Sensitivity = "SAFE") {
  return normalizeSensitivity(value, fallback);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
