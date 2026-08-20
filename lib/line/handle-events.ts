// lib/line/handle-events.ts — webhook 事件處理（驗簽後）
import type { WebhookEvent } from "@line/bot-sdk";
import { getLineClient } from "./client";
import { textMessage, bookingButtonFlex, welcomeMessages } from "./messages";
import { isAdminLineUser } from "./env";

function replyTokenFromEvent(event: WebhookEvent): string | undefined {
  return "replyToken" in event ? (event as { replyToken?: string }).replyToken : undefined;
}

export async function handleWebhookEvents(events: WebhookEvent[]): Promise<void> {
  for (const event of events) {
    try {
      await handleOneEvent(event);
    } catch (err) {
      // 單則失敗不拖垮同批（invariants §6）
      console.error("event handling failed:", err);
    }
  }
}

async function handleOneEvent(event: WebhookEvent): Promise<void> {
  const client = getLineClient();

  switch (event.type) {
    case "message": {
      if (event.message.type !== "text") return;
      const text = event.message.text.trim();

      // 1:1 才回「我的ID」
      if (text === "我的ID" && event.source.type === "user") {
        await client.replyMessage(replyTokenFromEvent(event)!, [
          textMessage(`您的 LINE ID：${event.source.userId}`),
        ]);
        return;
      }

      // 預約觸發關鍵字
      if (["預約", "我要預約", "預約服務"].includes(text)) {
        await client.replyMessage(replyTokenFromEvent(event)!, [
          textMessage("好的！請填寫預約表單："),
          bookingButtonFlex(),
        ]);
        return;
      }

      // 預設：禮貌回應（Phase 3 將由 AI 取代）
      await client.replyMessage(replyTokenFromEvent(event)!, [
        textMessage("您好，我是花園漫步預約小幫手。傳「預約」開啟表單；傳「我的ID」查 LINE ID。"),
      ]);
      return;
    }

    case "follow": {
      await client.replyMessage(replyTokenFromEvent(event)!, welcomeMessages());
      return;
    }

    default:
      return;
  }
}
