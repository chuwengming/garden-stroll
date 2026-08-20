// lib/chat/policy.ts — 閒聊輪數與冷靜期
export const SMALLTALK_MAX = 6;
export const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 小時

export function isInCooldown(closedAt: Date | null, now = new Date()): boolean {
  if (!closedAt) return false;
  return now.getTime() - closedAt.getTime() < COOLDOWN_MS;
}

export function shouldCloseSmalltalk(count: number): boolean {
  return count >= SMALLTALK_MAX;
}
