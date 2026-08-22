// lib/booking/availability-intent.ts — 「明天有空嗎」等可用性詢問（走預約+日期檢查，非 product FAQ）
/** 客人問特定日期／時段能否預約 → 必須走 buildBookingInviteMessage，不得只當 product 諮詢 */
export function isAvailabilityBookingQuestion(text: string): boolean {
  const t = text.trim();
  const asksSlot = /(有空|可約|能約|方便嗎|方便吗|有空嗎|有空吗|排得進|可以約|能排)/.test(t);
  const hasWhen =
    /(明天|明早|明晚|後天|后天|大後天|大后天|今天|今日)/.test(t) ||
    /(?:週|周|星期)[日一二三四五六天]/.test(t) ||
    /\d{1,2}[\/\-\.\月]\d{1,2}/.test(t) ||
    /\d{4}[\/\-年]\d{1,2}/.test(t);

  if (asksSlot && hasWhen) return true;

  // 「明天想剪髮」「後天能預約吗」
  if (hasWhen && /(預約|想約|想剪|想燙|想染|想洗|想護|約時間)/.test(t)) return true;

  return false;
}

/** 訊息是否指「明天」（相對用語） */
export function mentionsTomorrow(text: string): boolean {
  return /明天|明早|明晚/.test(text.trim());
}

export function mentionsDayAfterTomorrow(text: string): boolean {
  return /(後天|后天)/.test(text.trim());
}

export function mentionsToday(text: string): boolean {
  return /(今天|今日)/.test(text.trim());
}
