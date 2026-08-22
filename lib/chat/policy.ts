// lib/chat/policy.ts — 對話輪數與冷靜期
import type { Intent } from "@/lib/ai/classify";

export const DIALOGUE_MAX = 6;
export const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 小時

/** 第 6 輪（含）固定禮貌收尾 */
export const DIALOGUE_CLOSING_REPLY =
  "非常感謝您的耐心與理解！目前還有其他客人需要招待，我先在此為您服務到這裡。若之後想預約，隨時傳「預約」即可；有其他問題也歡迎改日再問，祝您有美好的一天 🙏";

export function isInCooldown(closedAt: Date | null, now = new Date()): boolean {
  if (!closedAt) return false;
  return now.getTime() - closedAt.getTime() < COOLDOWN_MS;
}

/** 是否已達對話輪數上限（一次來回 = 一輪） */
export function shouldCloseDialogue(count: number): boolean {
  return count >= DIALOGUE_MAX;
}

/** 是否計入 6 輪對話上限（開單／明確諮詢不計入，見 invariants §1） */
export function countsTowardDialogueRound(intent: Intent): boolean {
  return intent === "smalltalk" || intent === "unknown";
}
