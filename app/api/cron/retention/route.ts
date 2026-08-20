// app/api/cron/retention/route.ts — 資料保留清理（可設 Railway Cron）
import { NextRequest, NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/db/retention";

export async function GET(req: NextRequest) {
  // 簡單驗證：僅允許帶 query token 或本機呼叫
  const token = req.nextUrl.searchParams.get("token");
  const expected = process.env.CRON_TOKEN;
  if (expected && token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runRetentionCleanup();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("retention cleanup failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
