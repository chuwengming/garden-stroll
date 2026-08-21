// lib/admin/query.ts — 管理員固定查詢工具（invariants：不得任意 SQL）
import { thisMonthRange, lastMonthRange, todayRange, type DateRange } from "@/lib/booking/period";

interface TopRow {
  lineUserId: string;
  _count: { lineUserId: number };
}

interface ListRow {
  id: number;
  name: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  items: unknown;
  people: number;
  status: string;
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

export async function queryTopCustomers(range: "month" | "last_month", limit = 5): Promise<Array<{ lineUserId: string; count: number }>> {
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
    return rows.map((row) => ({ lineUserId: row.lineUserId, count: row._count.lineUserId }));
  } finally {
    await prisma.$disconnect();
  }
}

export async function queryList(range: "month" | "today", limit = 10): Promise<Array<Record<string, unknown>>> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const r = pickRange(range);
  try {
    const rows = (await prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        createdAt: { gte: r.start, lt: r.end },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, bookingDate: true, startTime: true, endTime: true, items: true, people: true, status: true },
    })) as unknown as ListRow[];
    return rows as unknown as Array<Record<string, unknown>>;
  } finally {
    await prisma.$disconnect();
  }
}

function pickRange(range: "month" | "last_month" | "today"): DateRange {
  if (range === "last_month") return lastMonthRange();
  if (range === "today") return todayRange();
  return thisMonthRange();
}
