// app/api/calendar/route.ts — 行事曆整月狀態（白/灰/綠）
import { NextRequest, NextResponse } from "next/server";
import { getDayStatus, monthDates, weekdayOf } from "@/lib/booking/schedule";
import type { ScheduleBooking, LeaveBlock } from "@/lib/booking/schedule";

const VALID_WEEKDAYS = [2, 3, 4, 5];

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") ?? "";
  const itemsParam = req.nextUrl.searchParams.get("items") ?? "";
  const items = itemsParam ? itemsParam.split(",").filter(Boolean) : ["haircut"];
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return NextResponse.json({ error: "month 格式需為 YYYY-MM" }, { status: 400 });
  const year = Number(m[1]);
  const monthNum = Number(m[2]);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return NextResponse.json({ error: "伺服器未設定資料庫" }, { status: 500 });

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const dates = monthDates(year, monthNum);
    const monthStart = dates[0];
    const monthEnd = dates[dates.length - 1];

    const [bookingRows, leaveRows] = await Promise.all([
      prisma.booking.findMany({
        where: {
          bookingDate: {
            gte: new Date(monthStart + "T00:00:00.000Z"),
            lt: new Date(monthEnd + "T23:59:59.999Z"),
          },
          status: { not: "cancelled" },
        },
      }),
      prisma.designerLeave.findMany({
        where: {
          leaveDate: {
            gte: new Date(monthStart + "T00:00:00.000Z"),
            lt: new Date(monthEnd + "T23:59:59.999Z"),
          },
        },
      }),
    ]);
    await prisma.$disconnect();

    const existing: ScheduleBooking[] = bookingRows.map((r) => ({
      bookingDate: r.bookingDate.toISOString().slice(0, 10),
      startTime: r.startTime,
      endTime: r.endTime,
      items: Array.isArray(r.items) ? (r.items as string[]) : [],
      status: r.status,
    }));
    const leaves: LeaveBlock[] = leaveRows.map((r) => ({
      leaveDate: r.leaveDate.toISOString().slice(0, 10),
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    const days = dates.map((date) => {
      const isWorkday = VALID_WEEKDAYS.includes(weekdayOf(date));
      const st = getDayStatus(date, items, existing, leaves, isWorkday);
      return { date, status: st.status, reason: st.reason, availableSlots: st.availableSlots };
    });

    return NextResponse.json({ month: month, days });
  } catch (err) {
    console.error("calendar failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
