// app/api/health/route.ts — 健康檢查
import { NextResponse } from "next/server";
import { hasLineCredentials, databaseUrl } from "@/lib/line/env";
import { hasAiKey, aiChatModel, aiWebSearchEnabled } from "@/lib/ai/env";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  const creds = hasLineCredentials();
  const dbUrl = databaseUrl();

  // 臨時診斷：FAQ 讀取狀態
  let faqStatus = { cwd: "", exists: false, length: 0, error: "" };
  try {
    const cwd = process.cwd();
    const p = join(cwd, "docs", "faq.md");
    const text = await readFile(p, "utf-8");
    faqStatus = { cwd, exists: true, length: text.length, error: "" };
  } catch (err) {
    faqStatus = { cwd: process.cwd(), exists: false, length: 0, error: String(err) };
  }

  let databaseOk = false;
  if (dbUrl) {
    try {
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      databaseOk = true;
    } catch {
      databaseOk = false;
    }
  }

  return NextResponse.json({
    ok: true,
    hasChannelSecret: creds.hasChannelSecret,
    hasChannelAccessToken: creds.hasChannelAccessToken,
    databaseOk,
    hasAiKey: hasAiKey(),
    aiChatModel: aiChatModel(),
    aiWebSearch: aiWebSearchEnabled(),
    faqStatus,
    timestamp: new Date().toISOString(),
  });
}
