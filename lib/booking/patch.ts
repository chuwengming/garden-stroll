// lib/booking/patch.ts — 取消／更改預約（invariants：只能改本人；取消改 status 不刪列）
export interface BookingRow {
  id: number;
  lineUserId: string;
  name: string;
  phone: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  items: string[];
  people: number;
  notes: string | null;
  status: string;
}

export async function findBookingById(bookingId: number, lineUserId: string): Promise<BookingRow | null> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const row = await prisma.booking.findFirst({
      where: { id: bookingId, lineUserId },
    });
    return (row as unknown as BookingRow) ?? null;
  } finally {
    await prisma.$disconnect();
  }
}

export async function cancelBooking(bookingId: number, lineUserId: string): Promise<boolean> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const result = await prisma.booking.updateMany({
      where: { id: bookingId, lineUserId, status: { not: "cancelled" } },
      data: { status: "cancelled" },
    });
    return result.count > 0;
  } finally {
    await prisma.$disconnect();
  }
}

export interface BookingAmendInput {
  bookingDate?: string | Date;
  startTime?: string;
  endTime?: string;
  items?: string[];
  people?: number;
  notes?: string;
}

export async function amendBooking(
  bookingId: number,
  lineUserId: string,
  updates: BookingAmendInput
): Promise<boolean> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const result = await prisma.booking.updateMany({
      where: { id: bookingId, lineUserId, status: { not: "cancelled" } },
      data: {
        ...(updates.bookingDate ? { bookingDate: new Date(updates.bookingDate + "T00:00:00.000Z") } : {}),
        ...(updates.startTime ? { startTime: updates.startTime } : {}),
        ...(updates.endTime ? { endTime: updates.endTime } : {}),
        ...(updates.items ? { items: updates.items as unknown as object } : {}),
        ...(updates.people ? { people: updates.people } : {}),
        ...(updates.notes !== undefined ? { notes: updates.notes ?? null } : {}),
      },
    });
    return result.count > 0;
  } finally {
    await prisma.$disconnect();
  }
}

export async function listOwnBookings(lineUserId: string, limit = 5): Promise<BookingRow[]> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.booking.findMany({
      where: { lineUserId, status: { not: "cancelled" } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows as unknown as BookingRow[];
  } finally {
    await prisma.$disconnect();
  }
}
