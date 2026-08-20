// lib/db/dedupe.ts — webhook 事件去重（processed_events.webhook_event_id 唯一）
import type { WebhookEvent } from "@line/bot-sdk";
import { databaseUrl } from "@/lib/line/env";

type DedupeResult = { processed: WebhookEvent[]; skipped: number };

export async function dedupeEvent(events: WebhookEvent[]): Promise<DedupeResult> {
  const url = databaseUrl();
  const result: DedupeResult = { processed: [], skipped: 0 };

  if (!url) {
    // 無 DATABASE_URL：僅本機，略過去重（invariants §3）
    return { processed: events, skipped: 0 };
  }

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    for (const event of events) {
      const webhookEventId = event.webhookEventId ?? "";
      if (!webhookEventId) {
        result.processed.push(event);
        continue;
      }
      try {
        await prisma.processedEvent.create({
          data: { webhookEventId },
        });
        result.processed.push(event);
      } catch {
        result.skipped += 1; // 唯一鍵衝突 = 重送
      }
    }
    await prisma.$disconnect();
  } catch (err) {
    // DB 掛掉：不阻擋處理（回 200 已保證）；記 log
    console.error("dedupe failed, processing anyway:", err);
    return { processed: events, skipped: 0 };
  }

  return result;
}
