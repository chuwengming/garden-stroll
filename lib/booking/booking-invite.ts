// lib/booking/booking-invite.ts — 預約邀請訊息（禮貌確認 + 日期檢查）
import { parseRequestedDate, assessRequestedDate, formatRequestedDayLabel, formatDateLabel } from "./date-ref";
import { suggestNextSlot } from "./suggest";
import { todayInTaipei } from "./taipei-date";

/** 組合「您要預約是嗎？」+ 日期提醒 + 請填表單 */
export async function buildBookingInviteMessage(text: string): Promise<string> {
  const today = todayInTaipei();
  const prefix = "您要預約是嗎？";
  const requested = parseRequestedDate(text, today);

  if (requested) {
    const check = assessRequestedDate(requested, today);
    const dayLabel = formatRequestedDayLabel(text, requested);

    if (!check.ok) {
      const next = await suggestNextSlot();
      const reasonText =
        check.reason === "當天非營業日"
          ? `${dayLabel}本店休業`
          : `${dayLabel}${check.reason}`;
      let msg = `${prefix}不好意思，${reasonText}。本店僅週二至週五營業。`;
      if (next) msg += `最近可預約時段：${next}。`;
      msg += "請填寫預約表單選擇其他日期：";
      return msg;
    }

    return `${prefix}若您想預約 ${dayLabel}，請填寫預約表單：`;
  }

  const next = await suggestNextSlot();
  if (next) {
    return `${prefix}請填寫預約表單。最近可預約時段：${next}。`;
  }
  return `${prefix}請填寫預約表單：`;
}

export { formatDateLabel };
