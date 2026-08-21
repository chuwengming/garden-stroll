// lib/booking/schedule.ts — 預約時間地圖引擎（單設計師 + 並行容量）
import {
  isHeavy, START_SLOTS, timeToMinutes, minutesToTime, totalDuration, fitsBusinessHours,
} from "./durations";

export interface ScheduleBooking {
  id?: number;
  bookingDate: string;    // YYYY-MM-DD
  startTime: string;      // "09:00"
  endTime: string;        // "11:20"
  items: string[];        // ["perm","shampoo"]
  status?: string;
}

export interface LeaveBlock {
  leaveDate: string;
  startTime: string | null; // null = 整天
  endTime: string | null;
}

export interface DayStatus {
  date: string;
  status: "open" | "closed" | "partial"; // 白 / 灰 / 綠
  availableSlots: string[];
  reason?: string;
}

// ===== 基礎工具 =====
// 兩個時間區間是否重疊 [aStart,aEnd) vs [bStart,bEnd)
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

// ===== 並行容量判定（核心規則）=====
export type ConflictReason =
  | "heavy_conflict"
  | "shampoo_overload"
  | "cut_conflict"
  | "leave"
  | "after_hours"
  | null;

// 檢查在 [startTime, endTime) 放置 items 是否與既有預約/請假衝突
export function checkConflict(
  date: string,
  startTime: string,
  endTime: string,
  items: string[],
  existing: ScheduleBooking[],
  leaves: LeaveBlock[]
): { conflict: boolean; reason?: ConflictReason; hint?: string } {
  if (!fitsBusinessHours(startTime, items)) {
    return { conflict: true, reason: "after_hours", hint: "該時段超過營業時間（最晚 17:00 結束）" };
  }

  for (const lv of leaves) {
    if (lv.leaveDate !== date) continue;
    if (lv.startTime === null) {
      return { conflict: true, reason: "leave", hint: "設計師當天請假" };
    }
    if (rangesOverlap(startTime, endTime, lv.startTime!, lv.endTime ?? lv.startTime!)) {
      return { conflict: true, reason: "leave", hint: "該時段設計師請假" };
    }
  }

  const overlapping = existing.filter((b) =>
    b.bookingDate === date && b.status !== "cancelled" &&
    rangesOverlap(startTime, endTime, b.startTime, b.endTime)
  );

  const heavyCount = overlapping.filter((b) => b.items.some(isHeavy)).length;
  const shampooCount = overlapping.filter((b) => b.items.some((i) => i === "shampoo" || i === "conditioning")).length;
  const cutCount = overlapping.filter((b) => b.items.includes("haircut")).length;

  const newHeavy = items.some(isHeavy);
  const newShampooLike = items.some((i) => i === "shampoo" || i === "conditioning");
  const newCut = items.includes("haircut");

  if (newHeavy) {
    if (heavyCount >= 1) {
      return { conflict: true, reason: "heavy_conflict", hint: "該時段已有燙髮/染髮服務中" };
    }
    if (shampooCount > 1 || cutCount > 1) {
      return { conflict: true, reason: "shampoo_overload", hint: "該時段並行服務已滿" };
    }
    return { conflict: false };
  }

  if (newCut) {
    if (shampooCount > 0) {
      return { conflict: true, reason: "cut_conflict", hint: "剪髮時段無法同時安排洗髮/護髮" };
    }
    if (cutCount >= 1) {
      return { conflict: true, reason: "cut_conflict", hint: "該時段已有剪髮服務" };
    }
    if (heavyCount > 1) {
      return { conflict: true, reason: "heavy_conflict", hint: "並行服務已滿" };
    }
    return { conflict: false };
  }

  if (newShampooLike) {
    if (shampooCount >= 2) {
      return { conflict: true, reason: "shampoo_overload", hint: "該時段洗髮/護髮已滿（最多 2 人）" };
    }
    if (cutCount > 0) {
      return { conflict: true, reason: "cut_conflict", hint: "該時段已有剪髮服務" };
    }
    if (heavyCount > 1) {
      return { conflict: true, reason: "heavy_conflict", hint: "並行服務已滿" };
    }
    return { conflict: false };
  }

  return { conflict: false };
}

// ===== 時間地圖查詢 =====
// 某日可用的開始時段（整點粒度；該時段有容量即允許）
export function getAvailableSlots(
  date: string,
  items: string[],
  existing: ScheduleBooking[],
  leaves: LeaveBlock[]
): string[] {
  const slots: string[] = [];
  for (const slot of START_SLOTS) {
    const end = minutesToTime(timeToMinutes(slot) + totalDuration(items));
    const result = checkConflict(date, slot, end, items, existing, leaves);
    if (!result.conflict) slots.push(slot);
  }
  return slots;
}

// 某日狀態（白/灰/綠）
export function getDayStatus(
  date: string,
  items: string[],
  existing: ScheduleBooking[],
  leaves: LeaveBlock[],
  isWorkday: boolean
): DayStatus {
  const available = getAvailableSlots(date, items, existing, leaves);
  if (!isWorkday) {
    return { date, status: "closed", availableSlots: [], reason: "weekend" };
  }
  const leave = leaves.find((l) => l.leaveDate === date && l.startTime === null);
  if (leave) {
    return { date, status: "closed", availableSlots: [], reason: "leave" };
  }
  if (available.length === 0) {
    return { date, status: "closed", availableSlots: [], reason: "full" };
  }
  const allAvailable = available.length === START_SLOTS.length;
  return { date, status: allAvailable ? "open" : "partial", availableSlots: available };
}

// 下一個可預約時段（供 AI 建議）
export function findNextSlot(
  fromDate: string,
  items: string[],
  existing: ScheduleBooking[],
  leaves: LeaveBlock[],
  isWorkday: (date: string) => boolean,
  maxDays = 30
): { date: string; slot: string } | null {
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(fromDate, i);
    if (!isWorkday(d)) continue;
    const slots = getAvailableSlots(d, items, existing, leaves);
    if (slots.length > 0) {
      return { date: d, slot: slots[0] };
    }
  }
  return null;
}

// ===== 日期工具 =====
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd;
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function monthDates(year: number, month: number): string[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: string[] = [];
  for (let d = 1; d <= days; d++) {
    result.push(year + "-" + String(month).padStart(2, "0") + "-" + String(d).padStart(2, "0"));
  }
  return result;
}
