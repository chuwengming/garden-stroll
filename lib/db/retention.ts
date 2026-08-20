// lib/db/retention.ts — 資料保留（processed_events 7 天、chat_messages 30 天）
// 由 Railway cron 或呼叫 /api/health 時低頻觸發；此處提供獨立清理函式
export async function runRetentionCleanup(): Promise<{ processedEvents: number; chatMessages: number }> {
  const url = process.env.DATABASE_URL;
  if (!url) return { processedEvents: 0, chatMessages: 0 };
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

    const pe = await prisma.processedEvent.deleteMany({
      where: { createdAt: { lt: sevenDaysAgo } },
    });
    const cm = await prisma.chatMessage.deleteMany({
      where: { createdAt: { lt: thirtyDaysAgo } },
    });
    return { processedEvents: pe.count, chatMessages: cm.count };
  } finally {
    await prisma.$disconnect();
  }
}
