// lib/admin/run-query.ts — 管理員查庫回覆組裝
import type { Message } from "@line/bot-sdk";
import { textMessage } from "@/lib/line/messages";
import type { AdminQueryKind, AdminQueryRange } from "./classify";
import { queryTotal, queryTopCustomers, queryList, queryDetail } from "./query";
import { extractDetailKeyword } from "./detail-keyword";
import { extractRequestedField, formatFieldAnswer } from "./field-query";
import { adminBookingRecordFlex, adminBookingCarousel } from "./booking-flex";
import type { AdminBookingRow } from "./format";

export interface AdminQueryResult {
  messages: Message[];
}

function bookingRecordMessages(
  rows: AdminBookingRow[],
  intro: string,
  itemsLabel: (items: string[]) => string
): Message[] {
  const messages: Message[] = [textMessage(`${intro}（共 ${rows.length} 筆）`)];
  if (rows.length === 1) {
    messages.push(adminBookingRecordFlex(rows[0], itemsLabel));
  } else {
    messages.push(adminBookingCarousel(rows, itemsLabel, intro));
  }
  return messages;
}

export async function runAdminQuery(
  q: { kind: AdminQueryKind; range: AdminQueryRange },
  text: string | undefined,
  itemsLabel: (items: string[]) => string
): Promise<AdminQueryResult> {
  if (q.kind === "detail") {
    const keyword = text ? extractDetailKeyword(text) : null;
    const rows = await queryDetail(keyword ?? "");
    if (rows.length === 0) {
      return { messages: [textMessage("找不到相符的預約或客人。")] };
    }

    const field = text ? extractRequestedField(text) : null;
    if (field) {
      const multi = rows.length > 1;
      const lines = rows.map((r) => formatFieldAnswer(r, field, itemsLabel, multi));
      return { messages: [textMessage(lines.join("\n"))] };
    }

    return { messages: bookingRecordMessages(rows, "🔍 查詢結果", itemsLabel) };
  }

  if (q.kind === "total") {
    const n = await queryTotal(q.range === "last_month" ? "last_month" : q.range === "today" ? "today" : "month");
    const label = q.range === "last_month" ? "上月" : q.range === "today" ? "今天" : "本月";
    return { messages: [textMessage(`📊 ${label}預約總量：${n} 筆（不含已取消）`)] };
  }

  if (q.kind === "top_customers") {
    const rows = await queryTopCustomers(q.range === "last_month" ? "last_month" : "month", 5);
    if (rows.length === 0) {
      return { messages: [textMessage("目前沒有足夠資料。")] };
    }
    const lines = rows.map((r, i) => `${i + 1}. ${r.name}｜${r.phone}｜${r.count} 次`);
    return { messages: [textMessage(`🏆 常客排名：\n${lines.join("\n")}`)] };
  }

  const rows = await queryList(q.range === "today" ? "today" : "month", 10);
  if (rows.length === 0) {
    return { messages: [textMessage("目前沒有預約記錄。")] };
  }
  const rangeLabel = q.range === "today" ? "今天" : "本月";
  return { messages: bookingRecordMessages(rows, `📋 預約列表（${rangeLabel}）`, itemsLabel) };
}
