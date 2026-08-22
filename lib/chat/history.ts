// lib/chat/history.ts — 對話歷史（供意圖理解與多輪澄清）
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 10;

export async function getRecentHistory(conversationKey: string, limit = MAX_HISTORY): Promise<ChatTurn[]> {
  const url = process.env.DATABASE_URL;
  if (!url) return [];
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const rows = await prisma.chatMessage.findMany({
      where: { conversationKey },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true },
    });
    await prisma.$disconnect();
    return rows.reverse().map((r) => ({
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
    }));
  } catch (err) {
    console.error("getRecentHistory failed:", err);
    return [];
  }
}

export async function appendMessage(conversationKey: string, role: ChatTurn["role"], content: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !content.trim()) return;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.chatMessage.create({
      data: { conversationKey, role, content: content.slice(0, 4000) },
    });
    await prisma.$disconnect();
  } catch (err) {
    console.error("appendMessage failed:", err);
  }
}

export function formatHistoryForPrompt(history: ChatTurn[]): string {
  if (history.length === 0) return "";
  return history.map((h) => `${h.role === "user" ? "客人" : "客服"}：${h.content}`).join("\n");
}
