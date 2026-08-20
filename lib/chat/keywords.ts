// lib/chat/keywords.ts — 關鍵字啟發式（AI 不可用時）
import type { Intent } from "@/lib/ai/classify";

export type KeywordIntent = Intent | "query";

export function keywordIntent(text: string): KeywordIntent | null {
  const t = text.trim();
  if (["預約", "我要預約", "預約服務", "訂位", "約時間"].some((k) => t.includes(k))) return "booking";
  if (["取消預約", "取消", "不去了"].some((k) => t.includes(k))) return "cancel";
  if (["更改預約", "修改預約", "改預約", "換時間"].some((k) => t.includes(k))) return "amend";
  if (["我的預約", "查預約", "訂單"].some((k) => t.includes(k))) return "query";
  return null;
}
