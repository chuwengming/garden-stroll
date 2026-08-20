// lib/booking/validate.ts — 預約表單驗證（依 docs/form-schema.yaml）
export interface BookingInput {
  name: string;
  phone: string;
  bookingDate: string; // YYYY-MM-DD
  bookingSlot: string;
  bookingItem: string;
  people: number;
  notes?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
const VALID_ITEMS = ["haircut", "perm", "color", "shampoo"];
const VALID_WEEKDAYS = [2, 3, 4, 5]; // Tue..Fri

// 台北時區的今天日期字串 YYYY-MM-DD
export function todayInTaipei(): string {
  const now = new Date();
  const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
  const y = taipei.getUTCFullYear();
  const m = String(taipei.getUTCMonth() + 1).padStart(2, "0");
  const d = String(taipei.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCDay(); // 0=Sun..6=Sat
}

export function validateBooking(input: BookingInput): ValidationResult {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) errors.push("請填寫姓名");
  if (!input.phone || !/^[0-9\-\+\s]{8,15}$/.test(input.phone.trim())) errors.push("請填寫有效的電話號碼");

  if (!input.bookingDate) {
    errors.push("請選擇預約日期");
  } else {
    const today = todayInTaipei();
    if (input.bookingDate < today) errors.push("預約日期不得早於今天");
    const wd = weekdayOf(input.bookingDate);
    if (!VALID_WEEKDAYS.includes(wd)) errors.push("僅週二至週五可預約（目前週日/週六/週一暫不開放）");
  }

  if (!VALID_SLOTS.includes(input.bookingSlot)) errors.push("請選擇有效的時段");
  if (!VALID_ITEMS.includes(input.bookingItem)) errors.push("請選擇有效的服務項目");

  const people = Number(input.people);
  if (!Number.isInteger(people) || people < 1 || people > 10) errors.push("人數須為 1～10");

  return { ok: errors.length === 0, errors };
}
