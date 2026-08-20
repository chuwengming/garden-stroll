// app/api/health/route.ts — 健康檢查
import { NextResponse } from "next/server";
import { hasLineCredentials, databaseUrl } from "@/lib/line/env";
import { hasAiKey, aiChatModel, aiWebSearchEnabled } from "@/lib/ai/env";

export async function GET() {
  const creds = hasLineCredentials();
  const dbUrl = databaseUrl();

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
    timestamp: new Date().toISOString(),
  });
}
