// lib/line/handle-events.ts — webhook 事件處理（驗簽後）
import type { WebhookEvent } from "@line/bot-sdk";
import { getLineClient } from "./client";
import { textMessage, bookingButtonFlex, welcomeMessages } from "./messages";
import { classifyIntent } from "@/lib/ai/classify";
import { generateReply } from "@/lib/ai/reply";
import { keywordIntent } from "@/lib/chat/keywords";
import { getConversation, updateConversation } from "@/lib/chat/conversation";
import { shouldCloseSmalltalk, isInCooldown } from "@/lib/chat/policy";
import { aiApiKey } from "@/lib/ai/env";
import { isAdminLineUser } from "./env";
import { parseAdminQuery } from "@/lib/admin/parse";
import { queryTotal, queryTopCustomers, queryList } from "@/lib/admin/query";
import { getFlow, setFlow } from "@/lib/chat/flow";
import { startFlowMessages, handleFlowReplyMessages, type FlowContext } from "@/lib/chat/amend";
import { listOwnBookings } from "@/lib/booking/patch";

const ITEM_LABELS: Record<string, string> = {
  haircut: "剪髮", perm: "燙髮", color: "染髮", shampoo: "洗髮",
};

function replyTokenFromEvent(event: WebhookEvent): string | undefined {
  return "replyToken" in event ? (event as { replyToken?: string }).replyToken : undefined;
}

function conversationKey(event: WebhookEvent): string {
  if (event.source.type === "user") return `user:${event.source.userId}`;
  if (event.source.type === "group") return `group:${event.source.groupId}`;
  if (event.source.type === "room") return `room:${event.source.roomId}`;
  return "unknown";
}

function sourceUserId(event: WebhookEvent): string | undefined {
  return event.source.type === "user" ? event.source.userId : undefined;
}

function sourceSpeakerId(event: WebhookEvent): string | undefined {
  return "userId" in event.source ? (event.source as { userId?: string }).userId : undefined;
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
      const userId = sourceUserId(event);
      const speakerId = sourceSpeakerId(event);
      const isGroup = event.source.type === "group" || event.source.type === "room";

      // 1:1 才回「我的ID」
      if (text === "我的ID" && event.source.type === "user") {
        await client.replyMessage(replyToken!, [textMessage(`您的 LINE ID：${event.source.userId}`)]);
        return;
      }

      // === 管理員查庫（僅 1:1 + ADMIN）===
      if (event.source.type === "user" && userId && isAdminLineUser(userId)) {
        const adminQuery = parseAdminQuery(text);
        if (adminQuery) {
          const report = await runAdminQuery(adminQuery);
          await client.replyMessage(replyToken!, [textMessage(report)]);
          return;
        }
      }

      // === 進行中的流程（取消/更改）===
      const flow = await getFlow(key);
      if (flow) {
        const flowCtx: FlowContext = { key, userId: userId ?? speakerId ?? "", speakerId, isGroup };
        const reply = await handleFlowReplyMessages(text, flowCtx, flow);
        if (reply.handled) {
          await client.replyMessage(replyToken!, reply.messages.map((m) => textMessage(m)));
          return;
        }
        // passthrough（群組他人）→ 繼續一般流程
      }

      // === 查詢本人預約 ===
      if (userId && (text.includes("我的預約") || text.includes("查預約"))) {
        const bookings = await listOwnBookings(userId, 5);
        if (bookings.length === 0) {
          await client.replyMessage(replyToken!, [textMessage("您目前沒有預約記錄。")]);
          return;
        }
        const lines = bookings.map((b) => `#${b.id} ${b.bookingDate.toISOString().slice(0, 10)} ${b.bookingSlot} ${ITEM_LABELS[b.bookingItem] ?? b.bookingItem}（${b.status}）`);
        await client.replyMessage(replyToken!, [textMessage(`您的預約：\n${lines.join("\n")}`)]);
        return;
      }

      // === 取消／更改：優先於開表單 ===
      const kw = keywordIntent(text);
      if (kw === "cancel" || kw === "amend") {
        const flowCtx: FlowContext = { key, userId: userId ?? speakerId ?? "", speakerId, isGroup };
        const reply = await startFlowMessages(kw, flowCtx);
        await client.replyMessage(replyToken!, reply.messages.map((m) => textMessage(m)));
        return;
      }

      // === 冷靜期 ===
      const conv = await getConversation(key);
      if (conv && isInCooldown(conv.closedAt)) {
        if (kw === "booking") {
          await client.replyMessage(replyToken!, [textMessage("好的！請填寫預約表單："), bookingButtonFlex()]);
        } else {
          await client.replyMessage(replyToken!, [
            textMessage("感謝您的訊息！如有預約需求，請傳「預約」；其他問題可稍後再問，謝謝 🙏"),
          ]);
        }
        return;
      }

      // === 一般流程：AI 分類 ===
      const intent = aiApiKey() ? await classifyIntent(text) : (keywordIntent(text) as any) ?? "smalltalk";

      if (intent === "booking") {
        await client.replyMessage(replyToken!, [textMessage("好的！請填寫預約表單："), bookingButtonFlex()]);
        return;
      }

      if (intent === "product" || intent === "smalltalk") {
        const count = conv?.smalltalkCount ?? 0;
        const isSmalltalk = intent === "smalltalk";
        if (isSmalltalk && shouldCloseSmalltalk(count + 1)) {
          const reply = await generateReply("smalltalk", text, count + 1);
          await client.replyMessage(replyToken!, [textMessage(reply)]);
          await updateConversation(key, { smalltalkCount: count + 1, closedAt: new Date() });
          return;
        }
        const reply = await generateReply(intent, text, count + (isSmalltalk ? 1 : 0));
        await client.replyMessage(replyToken!, [textMessage(reply)]);
        if (isSmalltalk) await updateConversation(key, { smalltalkCount: count + 1 });
        return;
      }

      await client.replyMessage(replyToken!, [
        textMessage("您好，我是花園漫步預約小幫手。傳「預約」開啟表單；傳「我的ID」可查詢 LINE ID。"),
      ]);
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

async function runAdminQuery(q: NonNullable<ReturnType<typeof parseAdminQuery>>): Promise<string> {
  if (q.kind === "total") {
    const n = await queryTotal(q.range);
    const label = q.range === "last_month" ? "上月" : q.range === "today" ? "今天" : "本月";
    return `📊 ${label}預約總量：${n} 筆（不含已取消）`;
  }
  if (q.kind === "top_customers") {
    const rows = await queryTopCustomers(q.range === "last_month" ? "last_month" : "month", 5);
    if (rows.length === 0) return "目前沒有足夠資料。";
    const lines = rows.map((r, i) => `${i + 1}. ${r.lineUserId.slice(0, 12)}… ${r.count} 次`);
    return `🏆 常客排名：\n${lines.join("\n")}`;
  }
  const rows = await queryList(q.range === "today" ? "today" : "month", 10);
  if (rows.length === 0) return "目前沒有預約記錄。";
  const lines = rows.map((r: any) => `#${r.id} ${r.name} ${r.bookingDate.toISOString().slice(0, 10)} ${r.bookingSlot} ${ITEM_LABELS[r.bookingItem] ?? r.bookingItem} ${r.people}人`);
  return `📋 預約列表（${q.range === "today" ? "今天" : "本月"}）：\n${lines.join("\n")}`;
}
