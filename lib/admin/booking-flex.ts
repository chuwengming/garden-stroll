// lib/admin/booking-flex.ts — 管理員查詢：整筆預約以 Flex 表單式輸出
import type { FlexBubble, FlexMessage } from "@line/bot-sdk";
import type { AdminBookingRow } from "./format";

function formRow(label: string, value: string) {
  return {
    type: "box" as const,
    layout: "horizontal" as const,
    spacing: "sm" as const,
    contents: [
      { type: "text" as const, text: label, size: "sm" as const, color: "#888888", flex: 2 },
      { type: "text" as const, text: value, size: "sm" as const, wrap: true, flex: 5 },
    ],
  };
}

function bookingBubble(r: AdminBookingRow, itemsLabel: (items: string[]) => string): FlexBubble {
  const itemArr = Array.isArray(r.items) ? (r.items as string[]) : [];
  const date = r.bookingDate.toISOString().slice(0, 10);
  const status = r.status ?? "confirmed";

  return {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `預約 #${r.id}`,
          weight: "bold",
          color: "#1DB446",
          size: "md",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        formRow("姓名", r.name),
        formRow("電話", r.phone?.trim() || "—"),
        formRow("日期", date),
        formRow("時段", `${r.startTime}～${r.endTime}`),
        formRow("服務", itemsLabel(itemArr) || "—"),
        formRow("人數", String(r.people)),
        ...(r.notes?.trim() ? [formRow("備註", r.notes.trim())] : []),
        formRow("狀態", status),
      ],
    },
  };
}

/** 單筆預約：一個表單 bubble */
export function adminBookingRecordFlex(
  r: AdminBookingRow,
  itemsLabel: (items: string[]) => string
): FlexMessage {
  return {
    type: "flex",
    altText: `預約 #${r.id} ${r.name}`,
    contents: bookingBubble(r, itemsLabel),
  };
}

/** 多筆預約：carousel（最多 12 筆） */
export function adminBookingCarousel(
  rows: AdminBookingRow[],
  itemsLabel: (items: string[]) => string,
  altText: string
): FlexMessage {
  const bubbles = rows.slice(0, 12).map((r) => bookingBubble(r, itemsLabel));
  return {
    type: "flex",
    altText,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
}
