// app/api/line/webhook/route.ts — Messaging API Webhook
import { NextRequest, NextResponse } from "next/server";
import type { WebhookEvent } from "@line/bot-sdk";
import { createHmac, timingSafeEqual } from "crypto";
import { handleWebhookEvents } from "@/lib/line/handle-events";
import { dedupeEvent } from "@/lib/db/dedupe";

// 驗簽：Channel Secret + raw body HMAC-SHA256（invariants §6：失敗 → 401）
function verifySignature(signature: string, rawBody: string): boolean {
  if (!signature) return false;
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifySignature(signature, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: WebhookEvent[] = [];
  try {
    events = JSON.parse(rawBody).events ?? [];
  } catch {
    return NextResponse.json({ ok: true }); // 格式錯誤仍 200，防 LINE 重送
  }

  // 去重（processed_events.webhook_event_id 唯一）
  const { processed, skipped } = await dedupeEvent(events);

  // 背景處理，不擋 200（invariants §6：約 1 秒內回 200）
  if (processed.length > 0) {
    void handleWebhookEvents(processed);
  }

  return NextResponse.json({ ok: true, processed: processed.length, skipped });
}
