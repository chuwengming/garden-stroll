#!/usr/bin/env node
// scripts/retention-cron.mjs — Railway cron：定期清理暫存資料
// processed_events 7 天、chat_messages 30 天；執行完即退出
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 未設定，略過清理");
  process.exit(0);
}

const prisma = new PrismaClient();
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

try {
  const pe = await prisma.processedEvent.deleteMany({
    where: { createdAt: { lt: sevenDaysAgo } },
  });
  const cm = await prisma.chatMessage.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  });
  console.log(
    `[retention] ${new Date().toISOString()} 清理完成: processed_events=${pe.count}, chat_messages=${cm.count}`
  );
} catch (err) {
  console.error("[retention] 清理失敗:", err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
  process.exit(0);
}
