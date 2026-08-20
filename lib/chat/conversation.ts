// lib/chat/conversation.ts — 對話狀態管理
import { isInCooldown, shouldCloseSmalltalk } from "./policy";

export interface ConversationState {
  key: string;
  smalltalkCount: number;
  closedAt: Date | null;
}

export async function getConversation(key: string): Promise<ConversationState | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const row = await prisma.conversation.findUnique({ where: { key } });
    await prisma.$disconnect();
    if (!row) return null;
    return { key: row.key, smalltalkCount: row.smalltalkCount, closedAt: row.closedAt };
  } catch {
    return null;
  }
}

export async function updateConversation(key: string, delta: Partial<ConversationState>): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.conversation.upsert({
      where: { key },
      update: {
        ...(delta.smalltalkCount !== undefined ? { smalltalkCount: delta.smalltalkCount } : {}),
        ...(delta.closedAt !== undefined ? { closedAt: delta.closedAt } : {}),
      },
      create: {
        key,
        smalltalkCount: delta.smalltalkCount ?? 0,
        closedAt: delta.closedAt ?? null,
      },
    });
    await prisma.$disconnect();
  } catch (err) {
    console.error("conversation update failed:", err);
  }
}
