// app/api/leaves/route.ts — 設計師請假管理（僅 ADMIN）
import { NextRequest, NextResponse } from "next/server";
import { isAdminLineUser } from "@/lib/line/env";
import { isValidCalendarDate } from "@/lib/booking/validate";

// 驗證管理員（query 帶 userId 或由 webhook 流程呼叫）
function isAdmin(req: NextRequest): boolean {
  const uid = req.headers.get("x-line-user-id") ?? req.nextUrl.searchParams.get("userId") ?? "";
  return isAdminLineUser(uid);
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const rows = await prisma.designerLeave.findMany({ orderBy: { leaveDate: "asc" } });
    await prisma.$disconnect();
    return NextResponse.json({
      leaves: rows.map((r) => ({
        id: r.id,
        leaveDate: r.leaveDate.toISOString().slice(0, 10),
        startTime: r.startTime,
        endTime: r.endTime,
        reason: r.reason,
      })),
    });
  } catch (err) {
    console.error("leaves list failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "無效的請求格式" }, { status: 400 });
  }
  const leaveDate = String(body.leaveDate ?? "");
  const startTime = body.startTime ? String(body.startTime) : null;
  const endTime = body.endTime ? String(body.endTime) : null;
  const reason = body.reason ? String(body.reason) : null;

  if (!isValidCalendarDate(leaveDate)) {
    return NextResponse.json({ error: "請假日期格式不正確" }, { status: 400 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const created = await prisma.designerLeave.create({
      data: {
        leaveDate: new Date(leaveDate + "T00:00:00.000Z"),
        startTime,
        endTime,
        reason,
      },
    });
    await prisma.$disconnect();
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("leave create failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
