// app/api/health/route.ts — 健康檢查
import { NextResponse } from "next/server";
import { hasLineCredentials, databaseUrl } from "@/lib/line/env";

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

  // ok 不因 MySQL 失敗而 false（invariants §6）
  return NextResponse.json({
    ok: true,
    hasChannelSecret: creds.hasChannelSecret,
    hasChannelAccessToken: creds.hasChannelAccessToken,
    databaseOk,
    timestamp: new Date().toISOString(),
  });
}
