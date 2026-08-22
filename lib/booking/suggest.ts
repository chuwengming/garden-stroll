// lib/booking/suggest.ts — 建議下一個可預約時段
import { todayInTaipei } from "./taipei-date";
import { formatDateLabel } from "./date-ref";
import { findNextSlot, weekdayOf, type ScheduleBooking, type LeaveBlock } from "./schedule";

export async function suggestNextSlot(defaultItems: string[] = ["haircut"]): Promise<string | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const today = todayInTaipei();
    const [bookingRows, leaveRows] = await Promise.all([
      prisma.booking.findMany({ where: { status: { not: "cancelled" } } }),
      prisma.designerLeave.findMany(),
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

    const next = findNextSlot(
      today,
      defaultItems,
      existing,
      leaves,
      (d) => [2, 3, 4, 5].includes(weekdayOf(d)),
      30
    );
    if (!next) return null;
    return `${formatDateLabel(next.date)} ${next.slot}`;
  } catch (err) {
    console.error("suggestNextSlot failed:", err);
    return null;
  }
}
