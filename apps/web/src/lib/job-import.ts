import type { MarketCode } from "@prisma/client";
import { scoreJob, parseDeadline } from "./job-matching";

export type ParsedJobInput = {
  market: MarketCode;
  company: string;
  title: string;
  location?: string | null;
  sourceUrl?: string | null;
  description: string;
  postedAt?: Date | null;
  deadline?: Date | null;
  matchScore: number;
  visaRisk: string;
  graduateFit: string;
  keywords: string[];
  positiveReasons: string[];
  negativeReasons: string[];
  riskSignals: string[];
  rawText: string;
  confidence: number;
};

export type JobParseIssue = {
  rawText: string;
  reason: string;
  sourceUrl?: string | null;
};

type ParsedRowCandidate = Record<string, unknown> & {
  rawBlock?: string;
};

const marketAliases: Array<[MarketCode, string[]]> = [
  ["CN", ["中国", "大陆", "上海", "北京", "深圳", "广州", "杭州", "校招", "实习"]],
  ["SG", ["新加坡", "singapore", "sg"]],
  ["HK", ["香港", "hong kong", "hk"]],
  ["AU", ["澳洲", "澳大利亚", "sydney", "melbourne", "brisbane", "australia"]],
  ["GLOBAL", ["remote", "global", "远程"]]
];

const headerMap: Record<string, keyof ParsedJobInput | "url"> = {
  market: "market",
  市场: "market",
  company: "company",
  公司: "company",
  title: "title",
  岗位: "title",
  职位: "title",
  location: "location",
  地点: "location",
  城市: "location",
  sourceurl: "sourceUrl",
  url: "sourceUrl",
  链接: "sourceUrl",
  description: "description",
  jd: "description",
  描述: "description",
  职位描述: "description"
};

const rolePattern = /engineer|developer|software|data|analyst|intern|internship|graduate|backend|front[\s-]?end|full[\s-]?stack|security|cloud|devops|product|programmer|技术|开发|算法|数据|测试|后端|前端|全栈|实习|校招|管培|工程师/i;
const locationPattern = /singapore|hong kong|sydney|melbourne|brisbane|perth|shanghai|beijing|shenzhen|guangzhou|hangzhou|remote|hybrid|onsite|中国|大陆|新加坡|香港|澳洲|澳大利亚|上海|北京|深圳|广州|杭州|远程|混合办公/i;
const metadataPattern = /^(posted|new|saved|save|apply|apply now|view job|view role|job alert|recommended|full[-\s]?time|part[-\s]?time|contract|permanent|internship|\d{4}|new today|today)$/i;
const noiseLinePatterns = [
  /unsubscribe/i,
  /manage preferences/i,
  /privacy policy/i,
  /terms of use/i,
  /view all jobs/i,
  /see more jobs/i,
  /jobs you may be interested/i,
  /job alert/i,
  /职位提醒/,
  /退订/,
  /隐私/,
  /查看全部/
];

function detectMarket(text: string): MarketCode {
  const normalized = text.toLowerCase();
  return marketAliases.find(([, aliases]) => aliases.some((alias) => normalized.includes(alias.toLowerCase())))?.[0] ?? "GLOBAL";
}

function normalizeMarket(value: string | undefined, fallbackText: string): MarketCode {
  const normalized = String(value || "").trim().toUpperCase();
  if (["AU", "SG", "HK", "CN", "GLOBAL"].includes(normalized)) return normalized as MarketCode;
  return detectMarket([value, fallbackText].filter(Boolean).join(" "));
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if ((char === "," || char === "\t") && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function looksLikeTable(text: string) {
  const firstLine = text.split(/\r?\n/).find(Boolean) || "";
  return firstLine.includes(",") || firstLine.includes("\t");
}

function parseTable(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((header) => {
    const key = header.replace(/\s+/g, "").toLowerCase();
    return headerMap[key] || headerMap[header] || header;
  });

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return {
      ...Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])),
      rawBlock: line
    };
  });
}

function cleanAlertLine(line: string) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/^[\s•·*_-]+/, "")
    .replace(/^\d+[\).、]\s*/, "")
    .trim();
}

function isNoiseLine(line: string) {
  const cleaned = cleanAlertLine(line);
  return !cleaned || noiseLinePatterns.some((pattern) => pattern.test(cleaned));
}

function stripKnownLabel(value: string) {
  return value
    .replace(/^(company|employer|公司|雇主|title|role|job title|position|岗位|职位|职位名称|location|city|地点|城市|link|url|apply|view job|申请链接|链接)\s*[:：-]\s*/i, "")
    .trim();
}

function looksLikeRoleLine(value: string) {
  return rolePattern.test(value);
}

function looksLikeLocationLine(value: string) {
  return locationPattern.test(value);
}

function isMetadataPart(value: string) {
  const normalized = stripKnownLabel(value).trim();
  return !normalized || metadataPattern.test(normalized) || noiseLinePatterns.some((pattern) => pattern.test(normalized)) || /^[$￥]/.test(normalized) || /^\d+\s*(天|days?|hours?|小时前|ago)$/i.test(normalized);
}

function hasExplicitJobLabel(line: string) {
  return /^(company|employer|公司|雇主|title|role|job title|position|岗位|职位|职位名称|location|city|地点|城市|link|url|apply|view job|申请链接|链接)\s*[:：]/i.test(cleanAlertLine(line));
}

function splitInlineParts(line: string) {
  const withoutUrl = line
    .replace(/https?:\/\/[^\s<>"')]+/gi, " ")
    .replace(/\b(apply now|view job|view role|查看职位|申请|点击申请|立即申请)\b/gi, " ");
  const firstPass = withoutUrl
    .split(/\s*(?:\||｜|丨|·|•|——|—|–)\s*|\s+-\s+/)
    .map(stripKnownLabel)
    .map((part) => part.trim())
    .filter((part) => part && !isMetadataPart(part) && !isNoiseLine(part));

  if (firstPass.length >= 2) return firstPass;

  return withoutUrl
    .split(/\s+at\s+/i)
    .map(stripKnownLabel)
    .map((part) => part.trim())
    .filter((part) => part && !isMetadataPart(part) && !isNoiseLine(part));
}

function extractLabeledFields(lines: string[]) {
  const fields: Partial<Record<"title" | "company" | "location" | "sourceUrl", string>> = {};

  for (const rawLine of lines) {
    const line = cleanAlertLine(rawLine);
    const value = line.replace(/^[^:：]+[:：]\s*/, "").trim();
    if (!value || value === line) continue;

    if (/^(title|role|job title|position|岗位|职位|职位名称)$/i.test(line.split(/[:：]/)[0].trim())) fields.title = value;
    if (/^(company|employer|公司|雇主)$/i.test(line.split(/[:：]/)[0].trim())) fields.company = value;
    if (/^(location|city|地点|城市)$/i.test(line.split(/[:：]/)[0].trim())) fields.location = value;
    if (/^(link|url|apply|view job|申请链接|链接)$/i.test(line.split(/[:：]/)[0].trim())) fields.sourceUrl = value.match(/https?:\/\/\S+/i)?.[0] ?? value;
  }

  return fields;
}

function rowFromParts(parts: string[], sourceUrl: string | null, rawBlock: string): ParsedRowCandidate | null {
  const cleaned = parts.map(stripKnownLabel).filter((part) => part && !isMetadataPart(part) && !isNoiseLine(part));
  if (cleaned.length < 2) return null;

  const titleIndex = cleaned.findIndex(looksLikeRoleLine);
  const title = (titleIndex >= 0 ? cleaned[titleIndex] : cleaned[0]) || "";
  const location = cleaned.find(looksLikeLocationLine) || "";
  const company =
    cleaned.find((part, index) => index !== titleIndex && part !== title && part !== location && !looksLikeRoleLine(part) && !looksLikeLocationLine(part)) ||
    cleaned.find((part, index) => index !== titleIndex && part !== title && part !== location) ||
    "";

  if (!title || !company) return null;

  return {
    title,
    company,
    location,
    sourceUrl,
    description: rawBlock,
    rawBlock
  };
}

function parseInlineAlertRows(text: string): ParsedRowCandidate[] {
  return text
    .split(/\r?\n/)
    .map(cleanAlertLine)
    .filter((line) => !isNoiseLine(line))
    .flatMap((line) => {
      const sourceUrl = cleanUrl(line.match(/https?:\/\/[^\s<>"')]+/i)?.[0] || "");
      const parts = splitInlineParts(line);
      const row = rowFromParts(parts, sourceUrl || null, line);
      return row ? [row] : [];
    });
}

function parseAlertLinkRows(text: string): ParsedRowCandidate[] {
  const lines = text
    .split(/\r?\n/)
    .map(cleanAlertLine)
    .filter((line) => !isNoiseLine(line));

  return lines.flatMap((line, index) => {
    const urls = line.match(/https?:\/\/[^\s<>"')]+/gi) ?? [];
    if (!urls.length) return [];

    return urls.flatMap((rawUrl) => {
      const sourceUrl = cleanUrl(rawUrl);
      const contextLines = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 3));
      const labels = extractLabeledFields(contextLines);
      const inlineRow = rowFromParts(splitInlineParts(contextLines.join(" | ")), sourceUrl, contextLines.join("\n"));

      if (labels.title && labels.company) {
        return [{
          title: labels.title,
          company: labels.company,
          location: labels.location || "",
          sourceUrl,
          description: contextLines.join("\n"),
          rawBlock: contextLines.join("\n")
        }];
      }

      if (inlineRow) return [{ ...inlineRow, sourceUrl }];

      const candidates = contextLines
        .map((item) => stripKnownLabel(item.replace(/https?:\/\/[^\s<>"')]+/gi, "")))
        .filter((item) => item && !isMetadataPart(item) && !isNoiseLine(item));
      const titleIndex = candidates.findIndex(looksLikeRoleLine);
      const title = titleIndex >= 0 ? candidates[titleIndex] : candidates[0] || "";
      const location = candidates.find(looksLikeLocationLine) || "";
      const company =
        candidates.find((candidate, candidateIndex) => candidateIndex !== titleIndex && candidate !== title && candidate !== location && !looksLikeRoleLine(candidate) && !looksLikeLocationLine(candidate)) ||
        candidates.find((candidate, candidateIndex) => candidateIndex !== titleIndex && candidate !== title && candidate !== location) ||
        "";

      return title && company
        ? [{
            title,
            company,
            location,
            sourceUrl,
            description: contextLines.join("\n"),
            rawBlock: contextLines.join("\n")
          }]
        : [];
    });
  });
}

function parseBlocks(text: string) {
  return text
    .split(/\n\s*\n|---+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block): ParsedRowCandidate[] => {
      const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length > 0 && lines.every((line) => /^https?:\/\//i.test(line))) {
        return [];
      }
      const urlLineCount = lines.filter((line) => /https?:\/\//i.test(line)).length;
      if (urlLineCount > 1 && !lines.some(hasExplicitJobLabel)) {
        return [];
      }
      if (lines.length > 12 && extractUrls(block).length > 1) {
        return [];
      }

      const labels = extractLabeledFields(lines);
      const contentLines = lines.filter((line) => !isNoiseLine(line));
      const titleLine = labels.title || contentLines.find((line) => /岗位|职位|title|role/i.test(line)) || contentLines.find(looksLikeRoleLine) || contentLines[0] || "";
      const companyLine = labels.company || contentLines.find((line) => /公司|company/i.test(line)) || contentLines.find((line) => !looksLikeRoleLine(line) && !looksLikeLocationLine(line) && !isMetadataPart(line)) || contentLines[1] || "";
      const locationLine = labels.location || contentLines.find((line) => /地点|城市|location/i.test(line)) || contentLines.find(looksLikeLocationLine) || "";
      const urlLine = labels.sourceUrl || lines.find((line) => /^https?:\/\//i.test(line) || /链接|url/i.test(line)) || "";

      return [{
        title: titleLine.replace(/^(岗位|职位|title|role)[:：]\s*/i, ""),
        company: companyLine.replace(/^(公司|company)[:：]\s*/i, ""),
        location: locationLine.replace(/^(地点|城市|location)[:：]\s*/i, ""),
        sourceUrl: (urlLine.match(/https?:\/\/\S+/i)?.[0] || "").trim(),
        description: block,
        rawBlock: block
      }];
    });
}

function extractUrls(text: string) {
  return Array.from(new Set(text.match(/https?:\/\/[^\s<>"')]+/gi) ?? [])).slice(0, 80);
}

function cleanUrl(value: string) {
  return value.replace(/[),.;\]]+$/g, "");
}

function titleFromUrl(url: URL) {
  const segments = url.pathname
    .split("/")
    .map((segment) => decodeURIComponent(segment).replace(/[-_]+/g, " ").trim())
    .filter(Boolean);
  const candidate = segments.reverse().find((segment) => /[a-zA-Z\u4e00-\u9fa5]/.test(segment) && !/job|jobs|careers|apply|岗位|职位/i.test(segment));
  return candidate ? candidate.slice(0, 120) : "待确认岗位";
}

function companyFromUrl(url: URL) {
  const hostParts = url.hostname.replace(/^www\./, "").split(".");
  const atsHosts = ["myworkdayjobs", "greenhouse", "lever", "smartrecruiters", "ashbyhq", "bamboohr"];
  const pathParts = url.pathname.split("/").filter(Boolean);
  const atsPathCompany = pathParts.find((part) => !/jobs?|careers?|apply|requisitions?|posting/i.test(part));

  if (atsHosts.some((host) => url.hostname.includes(host)) && atsPathCompany) {
    return decodeURIComponent(atsPathCompany).replace(/[-_]+/g, " ").slice(0, 120);
  }

  return (hostParts[0] || "待确认公司").replace(/[-_]+/g, " ").slice(0, 120);
}

function parseLinkRows(text: string): ParsedRowCandidate[] {
  return extractUrls(text).map((rawUrl) => {
    const sourceUrl = cleanUrl(rawUrl);
    try {
      const url = new URL(sourceUrl);
      const contextLine = text
        .split(/\r?\n/)
        .find((line) => line.includes(rawUrl))
        ?.trim();

      return {
        title: titleFromUrl(url),
        company: companyFromUrl(url),
        sourceUrl,
        description: contextLine || `从链接导入的岗位，原始链接：${sourceUrl}`,
        rawBlock: contextLine || sourceUrl
      };
    } catch {
      return {
        title: "",
        company: "",
        sourceUrl,
        description: sourceUrl,
        rawBlock: sourceUrl
      };
    }
  });
}

function issueForRow(row: ParsedRowCandidate, fallbackText: string): JobParseIssue | null {
  const title = String(row.title || "").trim();
  const company = String(row.company || "").trim();
  const sourceUrl = String(row.sourceUrl || "").trim() || null;

  if (!title && !company && !sourceUrl) {
    return null;
  }

  const missing = [
    !title ? "岗位名称" : null,
    !company ? "公司名称" : null
  ].filter(Boolean);

  if (!missing.length) return null;

  return {
    rawText: String(row.rawBlock || row.description || fallbackText).slice(0, 1200),
    reason: `缺少${missing.join("、")}`,
    sourceUrl
  };
}

function normalizeRow(row: ParsedRowCandidate, rawText: string): ParsedJobInput | null {
  const title = String(row.title || "").trim();
  const company = String(row.company || "").trim();
  const description = String(row.description || rawText || "").trim();

  if (!title || !company) return null;

  const market = normalizeMarket(String(row.market || ""), [title, company, row.location, description].join(" "));
  const scored = scoreJob({
    market,
    title,
    company,
    location: String(row.location || ""),
    description,
    sourceUrl: String(row.sourceUrl || "")
  });

  return {
    market,
    title,
    company,
    location: String(row.location || "").trim() || null,
    sourceUrl: String(row.sourceUrl || "").trim() || null,
    description: description || "从剪贴板导入的岗位，待补充 JD。",
    deadline: parseDeadline(description),
    matchScore: scored.matchScore,
    visaRisk: scored.visaRisk,
    graduateFit: scored.graduateFit,
    keywords: scored.keywords,
    positiveReasons: scored.positiveReasons,
    negativeReasons: scored.negativeReasons,
    riskSignals: scored.riskSignals,
    rawText,
    confidence: Math.min(95, 55 + scored.keywords.length * 5 + scored.positiveReasons.length * 8)
  };
}

export function parseJobClipboard(text: string) {
  const rows = looksLikeTable(text) ? parseTable(text) : [...parseBlocks(text), ...parseInlineAlertRows(text), ...parseAlertLinkRows(text), ...parseLinkRows(text)];
  const seen = new Set<string>();
  const uniqueRows = rows.filter((row) => {
    const sourceUrl = String(row.sourceUrl || "").trim().toLowerCase();
    const key = sourceUrl ? `url:${sourceUrl}` : [row.company, row.title, row.rawBlock].map((value) => String(value || "").trim().toLowerCase()).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const parsed = uniqueRows
    .map((row) => normalizeRow(row, text))
    .filter((row): row is ParsedJobInput => Boolean(row));
  const issues = uniqueRows
    .map((row) => issueForRow(row, text))
    .filter((issue): issue is JobParseIssue => Boolean(issue));
  const errors = issues.length;

  return {
    parsed,
    issues,
    errors,
    total: uniqueRows.length
  };
}
