// lib/chat/amend.ts — 取消／更改預約對話流程（回傳訊息由 handle-events 送出）
import { listOwnBookings, cancelBooking, amendBooking } from "@/lib/booking/patch";
import { setFlow, getFlow, type FlowState } from "./flow";
import { notifyBookingChanged } from "@/lib/line/notify-booking";
import { todayInTaipei, weekdayOf } from "@/lib/booking/validate";

const ITEM_LABELS: Record<string, string> = {
  haircut: "剪髮", perm: "燙髮", color: "染髮", shampoo: "洗髮",
};
const ITEM_MAP: Record<string, string> = { "剪髮": "haircut", "燙髮": "perm", "染髮": "color", "洗髮": "shampoo" };

export interface FlowContext {
  key: string;
  userId: string;
  speakerId?: string;
  isGroup: boolean;
}

export interface FlowReply {
  messages: string[];
  handled: boolean;   // true = 此訊息已被 flow 消費
  passthrough?: boolean; // true = 群組他人訊息，交給一般流程
}

// 起始：列出本人預約供選擇 → 回傳選擇清單
export async function startFlowMessages(kind: "cancel" | "amend", ctx: FlowContext): Promise<FlowReply> {
  const bookings = await listOwnBookings(ctx.userId, 5);

  if (bookings.length === 0) {
    return { messages: ["您目前沒有可取消／更改的預約。"], handled: true };
  }

  const lines = bookings.map((b, i) => `${i + 1}. #${b.id} ${b.bookingDate.toISOString().slice(0, 10)} ${b.bookingSlot} ${ITEM_LABELS[b.bookingItem] ?? b.bookingItem}`);
  await setFlow(ctx.key, {
    kind, step: "select", bookingId: bookings[0].id,
    speakerId: ctx.speakerId, createdAt: Date.now(),
  });

  return {
    messages: [`請回覆編號選擇要${kind === "cancel" ? "取消" : "更改"}的預約：\n${lines.join("\n")}\n\n（回「不用了」取消操作）`],
    handled: true,
  };
}

// 處理流程回覆：回傳要送出的訊息
export async function handleFlowReplyMessages(text: string, ctx: FlowContext, flow: FlowState): Promise<FlowReply> {
  const t = text.trim();

  if (t === "不用了" || t === "算了" || t === "取消操作") {
    await setFlow(ctx.key, null);
    return { messages: ["好的，已取消操作。"], handled: true };
  }

  // 群組：speakerId 不符 → passthrough（不得清他人流程）
  if (ctx.isGroup && flow.speakerId && flow.speakerId !== ctx.speakerId) {
    return { messages: [], handled: false, passthrough: true };
  }

  if (flow.step === "select") {
    const bookings = await listOwnBookings(ctx.userId, 5);
    const idx = parseInt(t, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= bookings.length) {
      return { messages: ["請回覆有效的編號（或「不用了」取消）。"], handled: true };
    }
    const b = bookings[idx];

    if (flow.kind === "cancel") {
      await setFlow(ctx.key, { kind: "cancel", step: "confirm", bookingId: b.id, speakerId: ctx.speakerId, createdAt: Date.now() });
      return {
        messages: [`確認要取消以下預約嗎？\n#${b.id} ${b.bookingDate.toISOString().slice(0, 10)} ${b.bookingSlot} ${ITEM_LABELS[b.bookingItem] ?? b.bookingItem}\n回「確認」取消，或「不用了」。`],
        handled: true,
      };
    } else {
      await setFlow(ctx.key, { kind: "amend", step: "field", bookingId: b.id, speakerId: ctx.speakerId, createdAt: Date.now(), updates: {} });
      return {
        messages: [`要更改 #${b.id} 的哪一項？\n1. 日期 2. 時段 3. 服務項目 4. 人數\n請回覆編號（或「不用了」取消）。`],
        handled: true,
      };
    }
  }

  // === 取消確認 ===
  if (flow.kind === "cancel" && flow.step === "confirm") {
    if (t === "確認" || t === "確定" || t === "是") {
      const ok = await cancelBooking(flow.bookingId, ctx.userId);
      await setFlow(ctx.key, null);
      if (ok) {
        await notifyBookingChanged(flow.bookingId, "cancelled").catch(() => {});
        return { messages: ["✅ 已取消預約。"], handled: true };
      }
      return { messages: ["取消失敗，請稍後再試。"], handled: true };
    }
    await setFlow(ctx.key, null);
    return { messages: ["好的，已取消操作。"], handled: true };
  }

  // === 更改：選欄位 ===
  if (flow.kind === "amend" && flow.step === "field") {
    const fieldIdx = parseInt(t, 10);
    if (isNaN(fieldIdx) || fieldIdx < 1 || fieldIdx > 4) {
      return { messages: ["請回覆 1～4 選擇要更改的欄位。"], handled: true };
    }
    const fieldMap = ["bookingDate", "bookingSlot", "bookingItem", "people"];
    const field = fieldMap[fieldIdx - 1];
    await setFlow(ctx.key, { ...flow, updates: { ...(flow.updates ?? {}), field } });

    const prompts: Record<string, string> = {
      bookingDate: "請輸入新日期（YYYY-MM-DD，週二～週五）：",
      bookingSlot: "請輸入新時段（09:00～16:00）：",
      bookingItem: "請輸入新服務項目（剪髮/燙髮/染髮/洗髮）：",
      people: "請輸入新人數（1～10）：",
    };
    return { messages: [prompts[field]], handled: true };
  }

  // === 更改：輸入新值 ===
  if (flow.kind === "amend" && flow.updates?.field) {
    const field = flow.updates.field as string;
    const value = t;
    const updates: Record<string, unknown> = { ...flow.updates };
    delete updates.field;

    if (field === "bookingDate") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { messages: ["日期格式請用 YYYY-MM-DD（例如 2026-08-25）。"], handled: true };
      }
      if (value < todayInTaipei()) {
        return { messages: ["預約日期不得早於今天。"], handled: true };
      }
      if (![2, 3, 4, 5].includes(weekdayOf(value))) {
        return { messages: ["僅週二至週五可預約。"], handled: true };
      }
      updates[field] = value;
    } else if (field === "bookingSlot") {
      if (!["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].includes(value)) {
        return { messages: ["時段請選 09:00～16:00 整點。"], handled: true };
      }
      updates[field] = value;
    } else if (field === "bookingItem") {
      const v = ITEM_MAP[value.trim()];
      if (!v) {
        return { messages: ["服務項目請選：剪髮／燙髮／染髮／洗髮。"], handled: true };
      }
      updates[field] = v;
    } else if (field === "people") {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 10) {
        return { messages: ["人數請填 1～10。"], handled: true };
      }
      updates[field] = n;
    }

    await setFlow(ctx.key, { kind: "amend", step: "confirm", bookingId: flow.bookingId, speakerId: ctx.speakerId, createdAt: Date.now(), updates });
    const pretty = Object.entries(updates)
      .map(([k, v]) => `${k} = ${v}`)
      .join(", ");
    return { messages: [`請確認更改：${pretty}。回「確認」完成，或「不用了」取消。`], handled: true };
  }

  // === 更改確認 ===
  if (flow.kind === "amend" && flow.step === "confirm") {
    if (t === "確認" || t === "確定" || t === "是") {
      const ok = await amendBooking(flow.bookingId, ctx.userId, flow.updates as any);
      await setFlow(ctx.key, null);
      if (ok) {
        await notifyBookingChanged(flow.bookingId, "amended").catch(() => {});
        return { messages: ["✅ 預約已更新。"], handled: true };
      }
      return { messages: ["更改失敗，請稍後再試。"], handled: true };
    }
    await setFlow(ctx.key, null);
    return { messages: ["好的，已取消操作。"], handled: true };
  }

  return { messages: [], handled: false };
}
