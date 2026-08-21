// lib/line/handle-events.ts — webhook 事件處理（驗簽後）
import type { WebhookEvent } from "@line/bot-sdk";
import { textMessage, bookingButtonFlex, welcomeMessages } from "./messages";
import { classifyIntent } from "@/lib/ai/classify";
import { generateReply } from "@/lib/ai/reply";
import { keywordIntent } from "@/lib/chat/keywords";
import { getConversation, updateConversation } from "@/lib/chat/conversation";
import { shouldCloseSmalltalk, isInCooldown } from "@/lib/chat/policy";
import { aiApiKey } from "@/lib/ai/env";
import { isAdminLineUser } from "./env";
import { classifyAdminIntent, type AdminQueryKind, type AdminQueryRange } from "@/lib/admin/classify";
import { parseLeaveIntent } from "@/lib/admin/leave-parse";
import { todayInTaipei } from "@/lib/booking/validate";
import { findNextSlot, weekdayOf, type ScheduleBooking, type LeaveBlock } from "@/lib/booking/schedule";
import { SERVICE_LABELS } from "@/lib/booking/durations";
import { queryTotal, queryTopCustomers, queryList } from "@/lib/admin/query";
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
          const report = await runAdminQuery(adminIntent);
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
      const conv = await getConversation(key);
      if (conv && isInCooldown(conv.closedAt)) {
        if (kw === "booking") {
          await replyOrPush(replyToken!, userId, [textMessage("好的！請填寫預約表單："), bookingButtonFlex()]);
        } else {
          await replyOrPush(replyToken!, userId, [
            textMessage("感謝您的訊息！如有預約需求，請傳「預約」；其他問題可稍後再問，謝謝 🙏"),
          ]);
        }
        return;
      }
      // 冷靜期已過：重置閒聊計數與收尾狀態（新一輪對話）
      if (conv?.closedAt) {
        await updateConversation(key, { smalltalkCount: 0, closedAt: null });
        conv.smalltalkCount = 0;
        conv.closedAt = null;
      }

      // === 一般流程：AI 分類 ===
      const kwIntent = keywordIntent(text);
      const intent = aiApiKey() ? await classifyIntent(text) : (kwIntent === "query" ? "product" : kwIntent) ?? "smalltalk";


      if (intent === "booking") {
        // 預約意圖：建議下一個可用時段（預設剪髮 1 小時）
        const suggestion = await suggestNextSlot();
        const msg = suggestion
          ? `好的！${suggestion}。請點下方按鈕開啟預約表單：`
          : "好的！請填寫預約表單：";
        await replyOrPush(replyToken!, userId, [textMessage(msg), bookingButtonFlex()]);
        return;
      }

      if (intent === "cancel" || intent === "amend") {
        const flowCtx: FlowContext = { key, userId: userId ?? speakerId ?? "", speakerId, isGroup };
        const reply = await startFlowMessages(intent, flowCtx, text);
        await replyOrPush(replyToken!, userId, reply.messages.map((m) => textMessage(m)));
        return;
      }

      if (intent === "product" || intent === "smalltalk" || intent === "unknown") {
        const count = conv?.smalltalkCount ?? 0;
        const isSmalltalk = intent === "smalltalk";
        if (isSmalltalk && shouldCloseSmalltalk(count + 1)) {
          const reply = await generateReply("smalltalk", text, count + 1);
          await replyOrPush(replyToken!, userId, [textMessage(reply)]);
          await updateConversation(key, { smalltalkCount: count + 1, closedAt: new Date() });
          return;
        }
        const reply = await generateReply(intent, text, count + (isSmalltalk ? 1 : 0));
        await replyOrPush(replyToken!, userId, [textMessage(reply)]);
        if (isSmalltalk) await updateConversation(key, { smalltalkCount: count + 1 });
        return;
      }

      await replyOrPush(replyToken!, userId, [
        textMessage("您好，我是花園漫步預約小幫手。傳「預約」開啟表單；傳「我的ID」可查詢 LINE ID。"),
      ]);
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

async function runAdminQuery(q: { kind: AdminQueryKind; range: AdminQueryRange }): Promise<string> {
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
  const lines = rows.map((row) => {
    const r = row as unknown as { id: number; name: string; bookingDate: Date; startTime: string; endTime: string; items: unknown; people: number };
    const itemArr = Array.isArray(r.items) ? (r.items as string[]) : [];
    return `#${r.id} ${r.name} ${r.bookingDate.toISOString().slice(0, 10)} ${r.startTime}～${r.endTime} ${itemsLabel(itemArr)} ${r.people}人`;
  });
  return `📋 預約列表（${q.range === "today" ? "今天" : "本月"}）：\n${lines.join("\n")}`;
}

// 管理員請假動作處理


// 建議下一個可預約時段（預設剪髮；回傳「9/12（四）10:00」或 null）
async function suggestNextSlot(): Promise<string | null> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const today = todayInTaipei();
    const [bookingRows, leaveRows] = await Promise.all([
      prisma.booking.findMany({ where: { status: { not: "cancelled" } } }),
      prisma.designerLeave.findMany(),
    ]);
    await prisma.$disconnect();

    const existing: ScheduleBooking[] = bookingRows.map((r) => ({
      bookingDate: r.bookingDate.toISOString().slice(0, 10),
      startTime: r.startTime,
      endTime: r.endTime,
      items: Array.isArray(r.items) ? (r.items as string[]) : [],
      status: r.status,
    }));
    const leaves: LeaveBlock[] = leaveRows.map((r) => ({
      leaveDate: r.leaveDate.toISOString().slice(0, 10),
      startTime: r.startTime,
      endTime: r.endTime,
    }));

    const next = findNextSlot(today, ["haircut"], existing, leaves, (d) => [2, 3, 4, 5].includes(weekdayOf(d)), 30);
    if (!next) return null;
    const wd = ["日", "一", "二", "三", "四", "五", "六"][weekdayOf(next.date)];
    const [, m, d] = next.date.split("-");
    return `${Number(m)}/${Number(d)}（${wd}）${next.slot}`;
  } catch (err) {
    console.error("suggestNextSlot failed:", err);
    return null;
  }
}

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

