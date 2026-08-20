// lib/booking/period.ts — 日期區間工具（台北時區）
export interface DateRange {
  start: Date;
  end: Date;
}

function taipeiNow(): Date {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

// 本月 1 日 00:00 ～ 下月 1 日 00:00（台北）
export function thisMonthRange(): DateRange {
  const now = taipeiNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1) - 8 * 3600 * 1000),
    end: new Date(Date.UTC(y, m + 1, 1) - 8 * 3600 * 1000),
  };
}

// 上個月區間
export function lastMonthRange(): DateRange {
  const now = taipeiNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - 8 * 3600 * 1000),
    end: new Date(Date.UTC(y, m, 1) - 8 * 3600 * 1000),
  };
}

// 今天 00:00 ～ 明天 00:00（台北）
export function todayRange(): DateRange {
  const now = taipeiNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  return {
    start: new Date(Date.UTC(y, m, d) - 8 * 3600 * 1000),
    end: new Date(Date.UTC(y, m, d + 1) - 8 * 3600 * 1000),
  };
}
