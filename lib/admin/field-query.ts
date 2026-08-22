// lib/admin/field-query.ts — 管理員只查單一欄位時的文字輸出
import type { AdminBookingRow } from "./format";

export type BookingField = "phone" | "name" | "date" | "time" | "items" | "people" | "notes" | "status";

const FIELD_LABELS: Record<BookingField, string> = {
  phone: "電話",
  name: "姓名",
  date: "日期",
  time: "時段",
  items: "服務",
  people: "人數",
  notes: "備註",
  status: "狀態",
};

/** 整筆預約紀錄 → null（改走 Flex 表單）；只問單欄 → 欄位名 */
export function extractRequestedField(text: string): BookingField | null {
  const t = text.trim();

  if (/(預約紀錄|預約記錄|預約資訊|預約資料|提供.*預約|列出.*預約|預約.*列表|預約.*清單|所有預約|全部預約)/.test(t)) {
    return null;
  }

  if (/的預約/.test(t) && !/(電話|手機|備註)/.test(t)) {
    return null;
  }

  if (/(電話|手機|聯絡方式|聯絡)/.test(t)) return "phone";
  if (/備註/.test(t)) return "notes";
  if (/(服務項目|服務內容|做了什麼|服務)/.test(t) && !/(列表|清單|全部)/.test(t)) return "items";
  if (/人數/.test(t)) return "people";
  if (/狀態/.test(t)) return "status";
  if (/(時段|幾點)/.test(t) || (/(時間)/.test(t) && !/(營業|開店|打烊|列表|清單)/.test(t))) return "time";
  if (/(日期|幾號|哪天)/.test(t) && !/(列表|清單)/.test(t)) return "date";
  if (/姓名/.test(t) && !/(列表|清單)/.test(t)) return "name";

  return null;
}

export function formatFieldAnswer(
  r: AdminBookingRow,
  field: BookingField,
  itemsLabel: (items: string[]) => string,
  multi = false
): string {
  const itemArr = Array.isArray(r.items) ? (r.items as string[]) : [];
  const date = r.bookingDate.toISOString().slice(0, 10);
  const label = FIELD_LABELS[field];
  const subject = multi ? `${r.name}（#${r.id}）` : r.name;

  let value: string;
  switch (field) {
    case "phone":
      value = r.phone?.trim() || "（無電話）";
      break;
    case "name":
      value = r.name;
      break;
    case "date":
      value = date;
      break;
    case "time":
      value = `${r.startTime}～${r.endTime}`;
      break;
    case "items":
      value = itemsLabel(itemArr) || "—";
      break;
    case "people":
      value = `${r.people} 人`;
      break;
    case "notes":
      value = r.notes?.trim() || "（無備註）";
      break;
    case "status":
      value = r.status ?? "confirmed";
      break;
  }

  return `${subject}的${label}：${value}`;
}
