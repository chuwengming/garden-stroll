// app/api/availability/route.ts — 單日可用時段（依選定項目）
import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, weekdayOf } from "@/lib/booking/schedule";
import type { ScheduleBooking, LeaveBlock } from "@/lib/booking/schedule";
import { totalDuration, timeToMinutes, minutesToTime, SERVICE_LABELS } from "@/lib/booking/durations";

const VALID_WEEKDAYS = [2, 3, 4, 5];

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const itemsParam = req.nextUrl.searchParams.get("items") ?? "";
  const items = itemsParam ? itemsParam.split(",").filter(Boolean) : ["haircut"];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date 格式需為 YYYY-MM-DD" }, { status: 400 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const [bookingRows, leaveRows] = await Promise.all([
      prisma.booking.findMany({
        where: { bookingDate: new Date(date + "T00:00:00.000Z"), status: { not: "cancelled" } },
      }),
      prisma.designerLeave.findMany({
        where: { leaveDate: new Date(date + "T00:00:00.000Z") },
      }),
    ]);
    await prisma.$disconnect();

    const existing: ScheduleBooking[] = bookingRows.map((r) => ({
      bookingDate: date,
      startTime: r.startTime,
      endTime: r.endTime,
      items: Array.isArray(r.items) ? (r.items as string[]) : [],
      status: r.status,
    }));
    const leaves: LeaveBlock[] = leaveRows.map((r) => ({
      leaveDate: date,
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    const isWorkday = VALID_WEEKDAYS.includes(weekdayOf(date));
    const slots = isWorkday ? getAvailableSlots(date, items, existing, leaves) : [];
    const totalMin = totalDuration(items);

    return NextResponse.json({
      date,
      isWorkday,
      items: items.map((i) => ({ value: i, label: SERVICE_LABELS[i] ?? i })),
      totalMinutes: totalMin,
      availableSlots: slots.map((s) => ({ start: s, end: minutesToTime(timeToMinutes(s) + totalMin) })),
    });
  } catch (err) {
    console.error("availability failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
