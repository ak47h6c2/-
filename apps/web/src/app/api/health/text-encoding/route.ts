import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ensureSeedData } from "@/lib/seed";

const suspiciousPatterns = [
  "\uFFFD",
  "\u93B5",
  "\u6D60",
  "\u6D93",
  "\u752F\u50DA",
  "\u7ED7",
  "\u934A\u5EA3\u7CA3",
  "\u935A",
  "\u6FEE",
  "\u9477",
  "\u6FC9",
  "\u6F83"
];

async function scanFile(filePath: string) {
  const text = await fs.readFile(filePath, "utf8");
  const hits = suspiciousPatterns.filter((pattern) => text.includes(pattern));
  return hits.length > 0 ? { filePath, hits } : null;
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "output") continue;
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (/\.(ts|tsx|js|html|css|md|json)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function GET() {
  await ensureSeedData();
  const root = process.cwd().replace(/\\apps\\web$/, "");
  const files = await collectFiles(root);
  const fileResults = (await Promise.all(files.map(scanFile))).filter(Boolean);
  const dbSamples = await prisma.job.findMany({
    where: {
      OR: suspiciousPatterns.flatMap((pattern) => [
        { title: { contains: pattern } },
        { company: { contains: pattern } },
        { description: { contains: pattern } }
      ])
    },
    select: { id: true, title: true, company: true },
    take: 20
  });

  return NextResponse.json({
    ok: fileResults.length === 0 && dbSamples.length === 0,
    files: fileResults,
    database: dbSamples
  });
}
