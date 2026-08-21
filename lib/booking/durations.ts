// lib/booking/durations.ts — 服務工時、營業時段、時段常量
// 營業：09:00 開始，最晚 17:00 結束（開始 + 總工時 ≤ 17:00）

export const SERVICE_DURATIONS: Record<string, number> = {
  shampoo: 40,        // 洗髮 40 分鐘
  conditioning: 20,   // 護髮 20 分鐘
  haircut: 60,        // 剪髮 1 小時
  color: 150,         // 染髮 2.5 小時
  perm: 180,          // 燙髮 3 小時
};

export const SERVICE_LABELS: Record<string, string> = {
  shampoo: "洗髮",
  conditioning: "護髮",
  haircut: "剪髮",
  color: "染髮",
  perm: "燙髮",
};

// 重服務（有等待空檔可並行）：燙髮/染髮
export function isHeavy(item: string): boolean {
  return item === "perm" || item === "color";
}

export const BUSINESS_START = "09:00";  // 營業開始
export const BUSINESS_END = "17:00";    // 最晚結束（超過不可預約）

// 開始時段（整點，1 小時粒度）：09:00～16:00
export const START_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

// 所有項目（表單複選）
export const ALL_ITEMS = Object.keys(SERVICE_DURATIONS);

// 計算項目總工時（分鐘）
export function totalDuration(items: string[]): number {
  return items.reduce((sum, it) => sum + (SERVICE_DURATIONS[it] ?? 0), 0);
}

// 時間字串 → 分鐘數（"09:00" → 540）
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 分鐘數 → 時間字串
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 開始時間 + 總工時 → 結束時間（分鐘比較；> BUSINESS_END 即超時）
export function endTimeOf(startTime: string, items: string[]): string {
  return minutesToTime(timeToMinutes(startTime) + totalDuration(items));
}

// 檢查是否在營業時段內結束
export function fitsBusinessHours(startTime: string, items: string[]): boolean {
  return timeToMinutes(startTime) + totalDuration(items) <= timeToMinutes(BUSINESS_END);
}
