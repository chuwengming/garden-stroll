// lib/line/handle-events.ts — webhook 事件處理（驗簽後）
import type { WebhookEvent, Message } from "@line/bot-sdk";
import { textMessage, bookingButtonFlex, welcomeMessages } from "./messages";
import { classifyIntent, effectiveIntent } from "@/lib/ai/classify";
import { generateReply } from "@/lib/ai/reply";
import { keywordIntent } from "@/lib/chat/keywords";
import { getConversation, updateConversation } from "@/lib/chat/conversation";
import { appendMessage, getRecentHistory } from "@/lib/chat/history";
import { shouldCloseDialogue, isInCooldown, countsTowardDialogueRound, DIALOGUE_CLOSING_REPLY } from "@/lib/chat/policy";
import { aiApiKey } from "@/lib/ai/env";
import { isAdminLineUser } from "./env";
import { classifyAdminIntent, type AdminQueryKind, type AdminQueryRange } from "@/lib/admin/classify";
import { parseLeaveIntent } from "@/lib/admin/leave-parse";
import { todayInTaipei } from "@/lib/booking/validate";
import { buildBookingInviteMessage } from "@/lib/booking/booking-invite";
import { isAvailabilityBookingQuestion } from "@/lib/booking/availability-intent";
import { SERVICE_LABELS } from "@/lib/booking/durations";
import { queryTotal, queryTopCustomers, queryList, queryDetail } from "@/lib/admin/query";
import { formatAdminBookingLine } from "@/lib/admin/format";
import { extractDetailKeyword } from "@/lib/admin/detail-keyword";
import { getFlow } from "@/lib/chat/flow";
import { startFlowMessages, handleFlowReplyMessages, type FlowContext } from "@/lib/chat/amend";
import { listOwnBookings } from "@/lib/booking/patch";
import { replyOrPush } from "./reply-or-push";

function itemsLabel(items: string[] | undefined): string {
  if (!items) return "";
  return items.map((it) => SERVICE_LABELS[it] ?? it).join("、");
}

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
        await replyOrPush(replyToken!, userId, [textMessage(`您的 LINE ID：${event.source.userId}`)]);
        return;
      }

      // === 管理員：請假管理（僅 1:1 + ADMIN）===
      if (event.source.type === "user" && userId && isAdminLineUser(userId)) {
        const leaveIntent = await parseLeaveIntent(text, todayInTaipei());
        if (leaveIntent) {
          const msg = await handleLeaveAction(leaveIntent);
          await replyOrPush(replyToken!, userId, [textMessage(msg)]);
          return;
        }
      }

      // === 管理員查庫（僅 1:1 + ADMIN；AI 意圖分流，規則為 fallback）===
      if (event.source.type === "user" && userId && isAdminLineUser(userId)) {
        const adminIntent = await classifyAdminIntent(text);
        if (adminIntent.isAdminQuery) {
          const report = await runAdminQuery(adminIntent, text);
          await replyOrPush(replyToken!, userId, [textMessage(report)]);
          return;
        }
      }

      // === 進行中的流程（取消/更改）===
      const flow = await getFlow(key);
      if (flow) {
        const flowCtx: FlowContext = { key, userId: userId ?? speakerId ?? "", speakerId, isGroup };
        const reply = await handleFlowReplyMessages(text, flowCtx, flow);
        if (reply.handled) {
          await replyOrPush(replyToken!, userId, reply.messages.map((m) => textMessage(m)));
          return;
        }
        // passthrough（群組他人）→ 繼續一般流程
      }

      // === 隱私防護：非管理員查他人/全部預約 → 拒絕 ===
      const othersRe = /(大家的預約|所有.*預約|全部.*預約|別人的預約|其他.*預約|每個.*預約|每個人.*預約|全部的訂單|所有人的)/;
      if (!isAdminLineUser(userId) && othersRe.test(text)) {
        await replyOrPush(replyToken!, userId, [
          textMessage("基於隱私保護，預約資訊僅供本人查詢。如需協助請直接聯繫店家，謝謝 🙏"),
        ]);
        return;
      }

      // === 查詢本人預約（自然語意；僅本人資料）===
      const ownQueryRe = /(我的預約|查預約|我有.*預約|預約.*查|查詢.*預約|我的.*預約.*看|看一下我的預約|我的訂單|查訂單)/;
      if (userId && ownQueryRe.test(text)) {
        const bookings = await listOwnBookings(userId, 5);
        if (bookings.length === 0) {
          await replyOrPush(replyToken!, userId, [textMessage("您目前沒有預約記錄。")]);
          return;
        }
        const lines = bookings.map((b) => `#${b.id} ${b.bookingDate.toISOString().slice(0, 10)} ${b.startTime}～${b.endTime} ${itemsLabel(b.items)}（${b.status}）`);
        await replyOrPush(replyToken!, userId, [textMessage(`您的預約：\n${lines.join("\n")}`)]);
        return;
      }

      // === 取消／更改：優先於開表單 ===
      const kw = keywordIntent(text);
      if (kw === "cancel" || kw === "amend") {
        const flowCtx: FlowContext = { key, userId: userId ?? speakerId ?? "", speakerId, isGroup };
        const reply = await startFlowMessages(kw, flowCtx, text);
        await replyOrPush(replyToken!, userId, reply.messages.map((m) => textMessage(m)));
        return;
      }

      // === 冷靜期 ===
      const convState = await getConversation(key);
      if (convState && isInCooldown(convState.closedAt)) {
        if (kw === "booking") {
          const msg = await buildBookingInviteMessage(text);
          await replyOrPush(replyToken!, userId, [textMessage(msg), bookingButtonFlex()]);
        } else {
          await replyOrPush(replyToken!, userId, [
            textMessage("感謝您的訊息！如有預約需求，請傳「預約」；取消／更改預約仍可為您服務，謝謝 🙏"),
          ]);
        }
        return;
      }
      if (convState?.closedAt) {
        await updateConversation(key, { smalltalkCount: 0, closedAt: null });
      }

      // === 一般流程：AI 分類 + 多輪對話 ===
      const history = await getRecentHistory(key);

      // 「明天有空嗎」等：優先日期檢查 + 預約表單（不走 product FAQ，避免誤答星期）
      if (isAvailabilityBookingQuestion(text)) {
        await appendMessage(key, "user", text);
        const msg = await buildBookingInviteMessage(text);
        await replyOrPush(replyToken!, userId, [textMessage(msg), bookingButtonFlex()]);
        await updateConversation(key, { smalltalkCount: 0, closedAt: null });
        await appendMessage(key, "assistant", msg);
        return;
      }

      const kwIntent = keywordIntent(text);
      const classified = aiApiKey()
        ? await classifyIntent(text, history)
        : { intent: (kwIntent === "query" ? "product" : kwIntent) ?? "smalltalk", confidence: "clear" as const };
      const intent = effectiveIntent(classified);

      await appendMessage(key, "user", text);

      const conv = (await getConversation(key)) ?? { key, smalltalkCount: 0, closedAt: null };
      const dialogueRound = conv.smalltalkCount;

      // 語意清楚 → 禮貌確認 + 日期檢查 + 預約表單
      if (classified.intent === "booking" && classified.confidence === "clear") {
        const msg = await buildBookingInviteMessage(text);
        await replyOrPush(replyToken!, userId, [textMessage(msg), bookingButtonFlex()]);
        await updateConversation(key, { smalltalkCount: 0, closedAt: null });
        await appendMessage(key, "assistant", msg);
        return;
      }

      if (intent === "cancel" || intent === "amend") {
        const flowCtx: FlowContext = { key, userId: userId ?? speakerId ?? "", speakerId, isGroup };
        const reply = await startFlowMessages(intent, flowCtx, text);
        await replyOrPush(replyToken!, userId, reply.messages.map((m) => textMessage(m)));
        await updateConversation(key, { smalltalkCount: 0, closedAt: null });
        return;
      }

      // 明確諮詢：FAQ 優先（不計入 6 輪）
      if (classified.intent === "product" && classified.confidence === "clear") {
        const reply = await generateReply("product", text, { history, dialogueRound: 0 });
        await replyOrPush(replyToken!, userId, [textMessage(reply)]);
        await appendMessage(key, "assistant", reply);
        return;
      }

      // 需澄清或閒聊：計入對話輪數（一次來回 = 一輪）
      const nextRound = countsTowardDialogueRound(intent) ? dialogueRound + 1 : dialogueRound;

      if (countsTowardDialogueRound(intent) && shouldCloseDialogue(nextRound)) {
        const reply = await generateReply(intent, text, { history, dialogueRound: nextRound });
        const finalReply = reply.includes("其他客人") ? reply : DIALOGUE_CLOSING_REPLY;
        await replyOrPush(replyToken!, userId, [textMessage(finalReply)]);
        await updateConversation(key, { smalltalkCount: nextRound, closedAt: new Date() });
        await appendMessage(key, "assistant", finalReply);
        return;
      }

      const reply = await generateReply(intent, text, {
        history,
        dialogueRound: countsTowardDialogueRound(intent) ? nextRound : 0,
      });

      let finalText = reply;
      const outbound: Message[] = [];
      const wantsBooking =
        intent === "unknown" &&
        /(預約|有空|約時間|想約|想剪|想燙|想染|想洗|明天|後天|后天|週[一二三四五六日天]|星期[一二三四五六日天])/.test(text);

      if (wantsBooking) {
        finalText = await buildBookingInviteMessage(text);
        outbound.push(textMessage(finalText), bookingButtonFlex());
      } else {
        outbound.push(textMessage(finalText));
      }

      await replyOrPush(replyToken!, userId, outbound);
      await appendMessage(key, "assistant", finalText);

      if (countsTowardDialogueRound(intent)) {
        await updateConversation(key, { smalltalkCount: nextRound });
      }
      return;
    }

    case "follow": {
      const followUserId = "userId" in event.source ? (event.source as { userId?: string }).userId : undefined;
      await replyOrPush(replyToken!, followUserId, welcomeMessages());
      return;
    }

    default:
      return;
  }
}

async function runAdminQuery(q: { kind: AdminQueryKind; range: AdminQueryRange }, text?: string): Promise<string> {
  if (q.kind === "detail") {
    const keyword = text ? extractDetailKeyword(text) : null;
    const rows = await queryDetail(keyword ?? "");
    if (rows.length === 0) return "找不到相符的預約或客人。";
    const lines = rows.map((r) => formatAdminBookingLine(r, itemsLabel));
    return `🔍 查詢結果：\n${lines.join("\n")}`;
  }
  if (q.kind === "total") {
    const n = await queryTotal(q.range === "last_month" ? "last_month" : q.range === "today" ? "today" : "month");
    const label = q.range === "last_month" ? "上月" : q.range === "today" ? "今天" : "本月";
    return `📊 ${label}預約總量：${n} 筆（不含已取消）`;
  }
  if (q.kind === "top_customers") {
    const rows = await queryTopCustomers(q.range === "last_month" ? "last_month" : "month", 5);
    if (rows.length === 0) return "目前沒有足夠資料。";
    const lines = rows.map((r, i) => `${i + 1}. ${r.name}｜${r.phone}｜${r.count} 次`);
    return `🏆 常客排名：\n${lines.join("\n")}`;
  }
  const rows = await queryList(q.range === "today" ? "today" : "month", 10);
  if (rows.length === 0) return "目前沒有預約記錄。";
  const lines = rows.map((r) => formatAdminBookingLine(r, itemsLabel));
  return `📋 預約列表（${q.range === "today" ? "今天" : "本月"}）：\n${lines.join("\n")}`;
}

// 管理員請假動作處理

async function handleLeaveAction(lv: {
  action: "add" | "remove" | "list" | null;
  leaveDate: string;
  startTime: string | null;
  endTime: string | null;
  reason?: string | null;
}): Promise<string> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return "伺服器未設定資料庫";

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    if (lv.action === "list") {
      const rows = await prisma.designerLeave.findMany({ orderBy: { leaveDate: "asc" } });
      if (rows.length === 0) return "目前沒有請假紀錄。";
      const lines = rows.map((r) => {
        const d = r.leaveDate.toISOString().slice(0, 10);
        const t = r.startTime ? `${r.startTime}～${r.endTime}` : "整天";
        return `${d} ${t}${r.reason ? "（" + r.reason + "）" : ""}`;
      });
      return `📅 請假紀錄：\n${lines.join("\n")}`;
    }

    if (lv.action === "remove") {
      if (!lv.leaveDate) return "請提供要刪除的請假日期";
      const deleted = await prisma.designerLeave.deleteMany({
        where: { leaveDate: new Date(lv.leaveDate + "T00:00:00.000Z") },
      });
      return deleted.count > 0 ? `✅ 已刪除 ${lv.leaveDate} 的請假` : `找不到 ${lv.leaveDate} 的請假紀錄`;
    }

    // add
    if (!lv.leaveDate) return "請提供請假日期（例如：9/12 請假）";
    await prisma.designerLeave.create({
      data: {
        leaveDate: new Date(lv.leaveDate + "T00:00:00.000Z"),
        startTime: lv.startTime,
        endTime: lv.endTime,
        reason: lv.reason ?? null,
      },
    });
    const period = lv.startTime ? `${lv.startTime}～${lv.endTime}` : "整天";
    return `✅ 已設定請假：${lv.leaveDate} ${period}${lv.reason ? "（" + lv.reason + "）" : ""}`;
  } finally {
    await prisma.$disconnect();
  }
}

