// lib/admin/format.ts — 管理員查詢結果格式化（每筆預約必含電話）

export interface AdminBookingRow {
  id: number;
  name: string;
  phone: string;
  bookingDate: Date;
  startTime: string;
  endTime: string;
  items: unknown;
  people: number;
  notes?: string | null;
  status?: string;
}

export function formatAdminBookingLine(
  r: AdminBookingRow,
  itemsLabel: (items: string[]) => string
): string {
  const itemArr = Array.isArray(r.items) ? (r.items as string[]) : [];
  const date = r.bookingDate.toISOString().slice(0, 10);
  const phone = r.phone?.trim() || "（無電話）";
  let line = `#${r.id} ${r.name}｜${phone}｜${date} ${r.startTime}～${r.endTime} ${itemsLabel(itemArr)} ${r.people}人`;
  if (r.notes) line += `｜備註:${r.notes}`;
  if (r.status && r.status !== "confirmed") line += `（${r.status}）`;
  return line;
}
