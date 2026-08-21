// app/api/bookings/route.ts — POST 預約（LIFF 送出即成立）
import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/line/verify-id-token";
import { validateSchedule, type BookingInput } from "@/lib/booking/validate";
import { totalDuration, timeToMinutes, minutesToTime, SERVICE_LABELS } from "@/lib/booking/durations";
import { notifyBookingConfirmed } from "@/lib/line/notify-booking";
import type { ScheduleBooking, LeaveBlock } from "@/lib/booking/schedule";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的請求格式" }, { status: 400 });
  }

  const { idToken, nonce, ...fields } = body;

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
    startTime: String(fields.startTime ?? ""),
    items: Array.isArray(fields.items) ? (fields.items as string[]) : [],
    people: Number(fields.people),
    notes: fields.notes ? String(fields.notes).trim() : undefined,
  };

  // 3. 讀取既有預約與請假，做排程衝突檢查（含並行容量）
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });
  }

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const [existingRows, leaveRows] = await Promise.all([
      prisma.booking.findMany({
        where: { bookingDate: new Date(input.bookingDate + "T00:00:00.000Z"), status: { not: "cancelled" } },
      }),
      prisma.designerLeave.findMany({
        where: { leaveDate: new Date(input.bookingDate + "T00:00:00.000Z") },
      }),
    ]);

    const existing: ScheduleBooking[] = existingRows.map((r) => ({
      bookingDate: input.bookingDate,
      startTime: r.startTime,
      endTime: r.endTime,
      items: Array.isArray(r.items) ? (r.items as string[]) : [],
      status: r.status,
    }));
    const leaves: LeaveBlock[] = leaveRows.map((r) => ({
      leaveDate: input.bookingDate,
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    const v = validateSchedule(input, existing, leaves);
    if (!v.ok) {
      await prisma.$disconnect();
      // 衝突時回可用的替代時段
      const { getAvailableSlots } = await import("@/lib/booking/schedule");
      const alternates = getAvailableSlots(input.bookingDate, input.items, existing, leaves);
      return NextResponse.json({
        error: v.errors.join("；"),
        alternates: alternates.length > 0 ? alternates : undefined,
      }, { status: 400 });
    }

    // upsert user
    await prisma.user.upsert({
      where: { lineUserId },
      update: {},
      create: { lineUserId },
    });

    const endTime = minutesToTime(timeToMinutes(input.startTime) + totalDuration(input.items));
    const booking = await prisma.booking.create({
      data: {
        lineUserId,
        name: input.name,
        phone: input.phone,
        bookingDate: new Date(input.bookingDate + "T00:00:00.000Z"),
        startTime: input.startTime,
        endTime,
        items: input.items as unknown as object,
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
      startTime: booking.startTime,
      endTime: booking.endTime,
      items: input.items,
      itemLabels: input.items.map((it) => SERVICE_LABELS[it] ?? it),
      people: booking.people,
      notes: booking.notes,
      status: booking.status,
    };

    void notifyBookingConfirmed(record);

    return NextResponse.json({ ok: true, booking: { id: booking.id, status: booking.status } });
  } catch (err) {
    console.error("booking create failed:", err);
    return NextResponse.json({ error: "預約寫入失敗，請稍後再試" }, { status: 500 });
  }
}
