// lib/booking/validate.ts — 預約表單驗證（依 docs/form-schema.yaml）
import {
  SERVICE_DURATIONS, START_SLOTS, timeToMinutes, totalDuration, fitsBusinessHours,
} from "./durations";
import { checkConflict, type ScheduleBooking, type LeaveBlock } from "./schedule";

export interface BookingInput {
  name: string;
  phone: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;
  items: string[];      // 複選
  people: number;
  notes?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const VALID_WEEKDAYS = [2, 3, 4, 5]; // Tue..Fri

import { todayInTaipei, weekdayInTaipei } from "./taipei-date";

// 驗證真實曆法日期
export function isValidCalendarDate(dateStr: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12) return false;
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d >= 1 && d <= daysInMonth;
}

export { todayInTaipei } from "./taipei-date";

export function weekdayOf(dateStr: string): number {
  return weekdayInTaipei(dateStr);
}

// 基本表單驗證（不含排程衝突）
export function validateBooking(input: BookingInput): ValidationResult {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push("請填寫姓名");
  } else if (input.name.length > 50) {
    errors.push("姓名過長（最多 50 字）");
  }
  if (!input.phone || !/^[0-9\-\+\s]{8,15}$/.test(input.phone.trim())) errors.push("請填寫有效的電話號碼");
  if (input.notes && input.notes.length > 190) errors.push("備註過長（最多 190 字）");

  if (!input.bookingDate) {
    errors.push("請選擇預約日期");
  } else if (!isValidCalendarDate(input.bookingDate)) {
    errors.push("預約日期格式或曆法不正確");
  } else {
    const today = todayInTaipei();
    if (input.bookingDate < today) errors.push("預約日期不得早於今天");
    const wd = weekdayOf(input.bookingDate);
    if (!VALID_WEEKDAYS.includes(wd)) errors.push("僅週二至週五可預約");
  }

  // 項目複選（至少 1 項，全部合法）
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) {
    errors.push("請至少選擇一個服務項目");
  } else {
    for (const it of items) {
      if (!(it in SERVICE_DURATIONS)) errors.push("包含無效的服務項目");
    }
  }

  // 時段（整點粒度）
  if (!START_SLOTS.includes(input.startTime)) errors.push("請選擇有效的開始時段");

  // 營業時間檢查
  if (items.length > 0 && input.startTime && !fitsBusinessHours(input.startTime, items)) {
    errors.push("該時段完成時間超過營業時間（最晚 17:00 結束）");
  }

  const people = Number(input.people);
  if (!Number.isInteger(people) || people < 1 || people > 10) errors.push("人數須為 1～10");

  return { ok: errors.length === 0, errors };
}

// 排程衝突檢查（建立預約前最後確認；含並行容量規則）
export function validateSchedule(
  input: BookingInput,
  existing: ScheduleBooking[],
  leaves: LeaveBlock[]
): ValidationResult {
  const base = validateBooking(input);
  if (!base.ok) return base;
  const end = minutesToTimeStr(timeToMinutes(input.startTime) + totalDuration(input.items));
  const result = checkConflict(input.bookingDate, input.startTime, end, input.items, existing, leaves);
  if (result.conflict) {
    return { ok: false, errors: [result.hint ?? "該時段無法預約"] };
  }
  return { ok: true, errors: [] };
}

function minutesToTimeStr(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}
