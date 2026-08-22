// lib/booking/taipei-date.ts — 台北時區日期（不受伺服器本地時區影響）
const TPE = "Asia/Taipei";

/** YYYY-MM-DD（台北「今天」） */
export function todayInTaipei(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TPE }).format(now);
}

export function weekdayInTaipei(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 4, 0, 0)); // 該日台北中午
  const w = new Intl.DateTimeFormat("en-US", { timeZone: TPE, weekday: "short" }).format(dt);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[w] ?? 0;
}

export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utcMs);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
