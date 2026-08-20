// lib/line/reply-or-push.ts — reply 失敗時 Push 同一組訊息（invariants §6）
import type { Message } from "@line/bot-sdk";
import { getLineClient } from "./client";

// replyToken 有效時用 reply；無效/失敗時改 Push 給 userId（完整訊息含按鈕）
export async function replyOrPush(
  replyToken: string | undefined,
  userId: string | undefined,
  messages: Message[]
): Promise<void> {
  const client = getLineClient();
  if (replyToken) {
    try {
      await client.replyMessage(replyToken, messages);
      return;
    } catch (err) {
      console.error("reply failed, falling back to push:", err);
    }
  }
  if (userId) {
    try {
      await client.pushMessage(userId, messages);
    } catch (err) {
      console.error("push fallback also failed:", err);
    }
  }
}
