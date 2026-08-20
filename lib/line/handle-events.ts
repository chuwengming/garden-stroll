// lib/line/handle-events.ts — webhook 事件處理（驗簽後）
import type { WebhookEvent } from "@line/bot-sdk";
import { getLineClient } from "./client";
import { textMessage, bookingButtonFlex, welcomeMessages } from "./messages";
import { classifyIntent } from "@/lib/ai/classify";
import { generateReply } from "@/lib/ai/reply";
import { keywordIntent } from "@/lib/chat/keywords";
import { getConversation, updateConversation } from "@/lib/chat/conversation";
import { SMALLTALK_MAX, shouldCloseSmalltalk, isInCooldown } from "@/lib/chat/policy";
import { aiApiKey } from "@/lib/ai/env";

function replyTokenFromEvent(event: WebhookEvent): string | undefined {
  return "replyToken" in event ? (event as { replyToken?: string }).replyToken : undefined;
}

function conversationKey(event: WebhookEvent): string {
  if (event.source.type === "user") return `user:${event.source.userId}`;
  if (event.source.type === "group") return `group:${event.source.groupId}`;
  if (event.source.type === "room") return `room:${event.source.roomId}`;
  return "unknown";
}

export async function handleWebhookEvents(events: WebhookEvent[]): Promise<void> {
  for (const event of events) {
    try {
      await handleOneEvent(event);
    } catch (err) {
      console.error("event handling failed:", err);
    }
  }
}

async function handleOneEvent(event: WebhookEvent): Promise<void> {
  const client = getLineClient();
  const replyToken = replyTokenFromEvent(event);

  switch (event.type) {
    case "message": {
      if (event.message.type !== "text") return;
      const text = event.message.text.trim();
      const key = conversationKey(event);

      // 1:1 才回「我的ID」
      if (text === "我的ID" && event.source.type === "user") {
        await client.replyMessage(replyToken!, [textMessage(`您的 LINE ID：${event.source.userId}`)]);
        return;
      }

      // 冷靜期內只回應明確預約/取消/更改意圖（invariants §1）
      const conv = await getConversation(key);
      if (conv && isInCooldown(conv.closedAt)) {
        const kw = keywordIntent(text);
        if (kw === "booking" || kw === "cancel" || kw === "amend") {
          await replyByIntent(kw, event, replyToken!, text, key, conv);
        } else {
          await client.replyMessage(replyToken!, [
            textMessage("感謝您的訊息！如有預約需求，請傳「預約」；其他問題可稍後再問，謝謝 🙏"),
          ]);
        }
        return;
      }

      // 正常流程：AI 分類（無 AI key 用關鍵字）
      const intent = aiApiKey() ? await classifyIntent(text) : (keywordIntent(text) as any) ?? "smalltalk";

      await replyByIntent(intent, event, replyToken!, text, key, conv);
      return;
    }

    case "follow": {
      await client.replyMessage(replyToken!, welcomeMessages());
      return;
    }

    default:
      return;
  }
}

async function replyByIntent(
  intent: string,
  event: WebhookEvent,
  replyToken: string,
  text: string,
  key: string,
  conv: { smalltalkCount: number; closedAt: Date | null } | null
): Promise<void> {
  const client = getLineClient();

  if (intent === "booking") {
    await client.replyMessage(replyToken, [
      textMessage("好的！請填寫預約表單："),
      bookingButtonFlex(),
    ]);
    return;
  }

  if (intent === "cancel" || intent === "amend") {
    // Phase 4 實作完整流程；目前先提示（invariants 待 Phase 4 填）
    await client.replyMessage(replyToken, [
      textMessage(`要${intent === "cancel" ? "取消" : "更改"}預約嗎？此功能即將開放，目前請直接來電店家協助處理。`),
    ]);
    return;
  }

  if (intent === "product" || intent === "smalltalk") {
    const count = conv?.smalltalkCount ?? 0;
    const isSmalltalk = intent === "smalltalk";

    // 閒聊：達到上限收尾（invariants §1）
    if (isSmalltalk && shouldCloseSmalltalk(count + 1)) {
      const reply = await generateReply("smalltalk", text, count + 1);
      await client.replyMessage(replyToken, [textMessage(reply)]);
      await updateConversation(key, { smalltalkCount: count + 1, closedAt: new Date() });
      return;
    }

    // 一般 product / smalltalk 回覆
    const reply = await generateReply(intent, text, count + (isSmalltalk ? 1 : 0));
    await client.replyMessage(replyToken, [textMessage(reply)]);

    if (isSmalltalk) {
      await updateConversation(key, { smalltalkCount: count + 1 });
    }
    return;
  }

  // 未知 → 預設
  await client.replyMessage(replyToken, [
    textMessage("您好，我是花園漫步預約小幫手。傳「預約」開啟表單；傳「我的ID」可查詢 LINE ID。"),
  ]);
}
