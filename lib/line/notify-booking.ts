// lib/line/notify-booking.ts — 預約成立通知
import type { TextMessage, FlexMessage } from "@line/bot-sdk";
import { getLineClient } from "./client";
import { adminLineUserIds } from "./env";
import type { BookingInput } from "@/lib/booking/validate";

export interface BookingRecord {
  id: number;
  lineUserId: string;
  name: string;
  phone: string;
  bookingDate: string;
  bookingSlot: string;
  bookingItem: string;
  people: number;
  notes?: string | null;
  status: string;
}

const ITEM_LABELS: Record<string, string> = {
  haircut: "剪髮",
  perm: "燙髮",
  color: "染髮",
  shampoo: "洗髮",
};

export function bookingSummaryFlex(b: BookingRecord): FlexMessage {
  return {
    type: "flex",
    altText: "花園漫步預約明細",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "花園漫步 — 預約明細", weight: "bold", size: "lg", color: "#1DB446" },
          { type: "separator" },
          { type: "text", text: `姓名：${b.name}` },
          { type: "text", text: `電話：${b.phone}` },
          { type: "text", text: `日期：${b.bookingDate}` },
          { type: "text", text: `時段：${b.bookingSlot}` },
          { type: "text", text: `服務：${ITEM_LABELS[b.bookingItem] ?? b.bookingItem}` },
          { type: "text", text: `人數：${b.people}` },
          ...(b.notes ? [{ type: "text" as const, text: `備註：${b.notes}` }] : []),
          { type: "separator" },
          { type: "text", text: "預約狀態：已成立（confirmed）", color: "#1DB446" },
        ],
      },
    },
  };
}

export async function notifyBookingConfirmed(b: BookingRecord): Promise<void> {
  const client = getLineClient();
  const messages = [bookingSummaryFlex(b)];

  // 1. 通知預約者本人
  try {
    await client.pushMessage(b.lineUserId, messages);
  } catch (err) {
    console.error("push to customer failed:", err);
  }

  // 2. 通知管理員（1:1 新預約 Push）
  for (const adminId of adminLineUserIds()) {
    try {
      await client.pushMessage(adminId, [
        { type: "text", text: `新預約 #${b.id}：${b.name} / ${ITEM_LABELS[b.bookingItem] ?? b.bookingItem} / ${b.bookingDate} ${b.bookingSlot}` },
      ]);
    } catch (err) {
      console.error("push to admin failed:", err);
    }
  }
}

// 取消／更改後通知（Push 給本人與管理員）
export async function notifyBookingChanged(bookingId: number, action: "cancelled" | "amended"): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const row = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!row) return;
    const actionText = action === "cancelled" ? "已取消" : "已更改";
    const msg = `預約 #${bookingId} ${actionText}：${row.name} / ${ITEM_LABELS[row.bookingItem] ?? row.bookingItem} / ${row.bookingDate.toISOString().slice(0, 10)} ${row.bookingSlot}`;
    const client = getLineClient();
    // Push 給本人
    try {
      await client.pushMessage(row.lineUserId, [{ type: "text", text: `✅ 您的預約 ${actionText}：${msg.replace(`預約 #${bookingId} `, "")}` }]);
    } catch (err) {
      console.error("push change to customer failed:", err);
    }
    // Push 給管理員
    for (const adminId of adminLineUserIds()) {
      try {
        await client.pushMessage(adminId, [{ type: "text", text: msg }]);
      } catch (err) {
        console.error("push change to admin failed:", err);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
