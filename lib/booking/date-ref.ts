// lib/booking/date-ref.ts — 從自然語解析預約日期 + 營業日檢查
import { isValidCalendarDate } from "./validate";
import { todayInTaipei, weekdayInTaipei, addCalendarDays } from "./taipei-date";
import {
  mentionsTomorrow,
  mentionsDayAfterTomorrow,
  mentionsToday,
} from "./availability-intent";

const VALID_WEEKDAYS = [2, 3, 4, 5]; // Tue..Fri
const WD_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function charToWeekday(ch: string): number | null {
  const map: Record<string, number> = {
    日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  };
  return map[ch] ?? null;
}

/** 從 today 起算，下一個（含當天）指定 weekday 的 YYYY-MM-DD */
function nextWeekdayOnOrAfter(today: string, targetWday: number): string {
  for (let i = 0; i < 14; i++) {
    const d = addCalendarDays(today, i);
    if (weekdayInTaipei(d) === targetWday) return d;
  }
  return addCalendarDays(today, 7);
}

export function formatDateLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  const wd = WD_LABELS[weekdayInTaipei(dateStr)];
  return `${Number(m)}/${Number(d)}（週${wd}）`;
}

/** 依客人用語加上「明天／後天」前綴，避免與「最近可預約」混淆 */
export function formatRequestedDayLabel(text: string, dateStr: string): string {
  const base = formatDateLabel(dateStr);
  if (mentionsTomorrow(text)) return `明天 ${base}`;
  if (mentionsDayAfterTomorrow(text)) return `後天 ${base}`;
  if (mentionsToday(text)) return `今天 ${base}`;
  return base;
}

/** 從訊息中解析客人想預約的日期（解析不到則 null） */
export function parseRequestedDate(text: string, today = todayInTaipei()): string | null {
  const t = text.trim();

  // 相對日期優先（須在「週X」規則之前，避免誤判）
  if (mentionsToday(t)) return today;
  if (mentionsTomorrow(t)) return addCalendarDays(today, 1);
  if (mentionsDayAfterTomorrow(t)) return addCalendarDays(today, 2);
  if (/(大後天|大后天)/.test(t)) return addCalendarDays(today, 3);

  const wdMatch = t.match(/(?:週|周|星期)([日一二三四五六天])/);
  if (wdMatch) {
    const w = charToWeekday(wdMatch[1]);
    if (w !== null) return nextWeekdayOnOrAfter(today, w);
  }

  const isoMatch = t.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  if (isoMatch) {
    const dateStr = `${isoMatch[1]}-${pad2(Number(isoMatch[2]))}-${pad2(Number(isoMatch[3]))}`;
    if (isValidCalendarDate(dateStr)) return dateStr;
  }

  const mdMatch = t.match(/(?<!\d)(\d{1,2})[\/\-\.](\d{1,2})(?!\d)/);
  if (mdMatch) {
    const y = Number(today.slice(0, 4));
    const dateStr = `${y}-${pad2(Number(mdMatch[1]))}-${pad2(Number(mdMatch[2]))}`;
    if (isValidCalendarDate(dateStr)) return dateStr;
  }

  return null;
}

export function assessRequestedDate(dateStr: string, today = todayInTaipei()): { ok: boolean; reason?: string } {
  if (dateStr < today) return { ok: false, reason: "該日期已過" };
  if (!VALID_WEEKDAYS.includes(weekdayInTaipei(dateStr))) {
    return { ok: false, reason: "當天非營業日" };
  }
  return { ok: true };
}
