// app/api/bookings/route.ts — POST 預約（LIFF 送出即成立）
import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line/verify-id-token";
import { validateBooking, type BookingInput } from "@/lib/booking/validate";
import { notifyBookingConfirmed } from "@/lib/line/notify-booking";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的請求格式" }, { status: 400 });
  }

  const { idToken, nonce, ...fields } = body;

  // 1. 後端驗 ID Token，不信任表單自填 userId（invariants §6）
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "缺少 LINE 登入憑證（ID Token）" }, { status: 401 });
  }

  let lineUserId: string;
  try {
    const payload = await verifyIdToken(idToken, typeof nonce === "string" ? nonce : undefined);
    lineUserId = payload.sub;
  } catch {
    return NextResponse.json({ error: "LINE 身份驗證失敗，請重新開啟表單" }, { status: 401 });
  }

  // 2. 表單驗證（前後端共用規則）
  const input: BookingInput = {
    name: String(fields.name ?? "").trim(),
    phone: String(fields.phone ?? "").trim(),
    bookingDate: String(fields.bookingDate ?? ""),
    bookingSlot: String(fields.bookingSlot ?? ""),
    bookingItem: String(fields.bookingItem ?? ""),
    people: Number(fields.people),
    notes: fields.notes ? String(fields.notes).trim() : undefined,
  };
  const v = validateBooking(input);
  if (!v.ok) {
    return NextResponse.json({ error: v.errors.join("；") }, { status: 400 });
  }

  // 3. 寫入 MySQL（通過驗證即 confirmed）
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });
  }

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    // upsert user
    await prisma.user.upsert({
      where: { lineUserId },
      update: {},
      create: { lineUserId },
    });

    const booking = await prisma.booking.create({
      data: {
        lineUserId,
        name: input.name,
        phone: input.phone,
        bookingDate: new Date(input.bookingDate + "T00:00:00.000Z"),
        bookingSlot: input.bookingSlot,
        bookingItem: input.bookingItem,
        people: input.people,
        notes: input.notes ?? null,
        status: "confirmed",
      },
    });

    await prisma.$disconnect();

    const record = {
      id: booking.id,
      lineUserId,
      name: booking.name,
      phone: booking.phone,
      bookingDate: input.bookingDate,
      bookingSlot: booking.bookingSlot,
      bookingItem: booking.bookingItem,
      people: booking.people,
      notes: booking.notes,
      status: booking.status,
    };

    // 4. 成功先回 JSON；LINE 通知用背景（invariants §6）
    void notifyBookingConfirmed(record);

    return NextResponse.json({ ok: true, booking: { id: booking.id, status: booking.status } });
  } catch (err) {
    console.error("booking create failed:", err);
    return NextResponse.json({ error: "預約寫入失敗，請稍後再試" }, { status: 500 });
  }
}
