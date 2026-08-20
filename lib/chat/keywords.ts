// lib/chat/keywords.ts — 關鍵字啟發式（AI 不可用時）
import type { Intent } from "@/lib/ai/classify";

export type KeywordIntent = Intent | "query";

// 注意：更精確的意圖（cancel/amend/query）必須先於泛化的「預約」判斷，
// 否則「取消預約」「更改預約」「我的預約」會被誤判為 booking。
export function keywordIntent(text: string): KeywordIntent | null {
  const t = text.trim();
  if (/(取消預約|取消|不去了|去不了|不想去了)/.test(t)) return "cancel";
  if (/(更改預約|修改預約|改預約|改時間|換時間|換一天)/.test(t)) return "amend";
  if (/(我的預約|查預約|查詢.*預約|我有.*預約|我的訂單)/.test(t)) return "query";
  if (/(預約|我要預約|預約服務|訂位|約時間|想約|排時間)/.test(t)) return "booking";
  return null;
}
