// lib/admin/query.ts — 管理員固定查詢工具（invariants：不得任意 SQL）
import { thisMonthRange, lastMonthRange, todayRange, type DateRange } from "@/lib/booking/period";
import type { AdminBookingRow } from "./format";

interface TopRow {
  lineUserId: string;
  _count: { lineUserId: number };
}

export async function queryTotal(range: "month" | "last_month" | "today"): Promise<number> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const r = pickRange(range);
  try {
    return await prisma.booking.count({
      where: {
        status: { not: "cancelled" },
        createdAt: { gte: r.start, lt: r.end },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function queryTopCustomers(
  range: "month" | "last_month",
  limit = 5
): Promise<Array<{ lineUserId: string; count: number; name: string; phone: string }>> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const r = pickRange(range);
  try {
    const rows = (await prisma.booking.groupBy({
      by: ["lineUserId"],
      where: {
        status: { not: "cancelled" },
        createdAt: { gte: r.start, lt: r.end },
      },
      _count: { lineUserId: true },
      orderBy: { _count: { lineUserId: "desc" } },
      take: limit,
    })) as unknown as TopRow[];

    const result: Array<{ lineUserId: string; count: number; name: string; phone: string }> = [];
    for (const row of rows) {
      const latest = await prisma.booking.findFirst({
        where: { lineUserId: row.lineUserId, status: { not: "cancelled" } },
        orderBy: { createdAt: "desc" },
        select: { name: true, phone: true },
      });
      result.push({
        lineUserId: row.lineUserId,
        count: row._count.lineUserId,
        name: latest?.name ?? "—",
        phone: latest?.phone ?? "—",
      });
    }
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

const bookingSelect = {
  id: true,
  name: true,
  phone: true,
  bookingDate: true,
  startTime: true,
  endTime: true,
  items: true,
  people: true,
  notes: true,
  status: true,
} as const;

export async function queryList(range: "month" | "today", limit = 10): Promise<AdminBookingRow[]> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const r = pickRange(range);
  try {
    return (await prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        createdAt: { gte: r.start, lt: r.end },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: bookingSelect,
    })) as AdminBookingRow[];
  } finally {
    await prisma.$disconnect();
  }
}

/** 查詢特定預約／客人（編號或姓名）；keyword 空字串時回傳最近預約 */
export async function queryDetail(keyword: string, limit = 5): Promise<AdminBookingRow[]> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const kw = keyword.replace(/[#\s]/g, "").trim();
  try {
    if (!kw) {
      return (await prisma.booking.findMany({
        where: { status: { not: "cancelled" } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: bookingSelect,
      })) as AdminBookingRow[];
    }

    const idMatch = /^(\d+)$/.exec(kw);
    return (await prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        OR: [
          ...(idMatch ? [{ id: Number(idMatch[1]) }] : []),
          { name: { contains: kw } },
          { phone: { contains: kw } },
        ],
      },
      orderBy: { bookingDate: "desc" },
      take: limit,
      select: bookingSelect,
    })) as AdminBookingRow[];
  } finally {
    await prisma.$disconnect();
  }
}

function pickRange(range: "month" | "last_month" | "today"): DateRange {
  if (range === "last_month") return lastMonthRange();
  if (range === "today") return todayRange();
  return thisMonthRange();
}
