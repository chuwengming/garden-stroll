// app/api/leaves/[id]/route.ts — 刪除請假（僅 ADMIN）
import { NextRequest, NextResponse } from "next/server";
import { isAdminLineUser } from "@/lib/line/env";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const uid = req.headers.get("x-line-user-id") ?? req.nextUrl.searchParams.get("userId") ?? "";
  if (!isAdminLineUser(uid)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(idStr);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.designerLeave.delete({ where: { id } });
    await prisma.$disconnect();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("leave delete failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
