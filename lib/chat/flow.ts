// lib/chat/flow.ts — 對話流程狀態管理（群組改單綁 speakerId）
export type FlowKind = "cancel" | "amend";
export type FlowStep = "select" | "field" | "confirm";

export interface FlowState {
  kind: FlowKind;
  step: FlowStep;
  bookingId: number;
  speakerId?: string;
  updates?: Record<string, unknown>;
  createdAt: number;
}

export async function setFlow(key: string, state: FlowState | null): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    if (state === null) {
      const { Prisma } = await import("@prisma/client");
      await prisma.conversation.update({ where: { key }, data: { flowJson: Prisma.DbNull } });
    } else {
      await prisma.conversation.upsert({
        where: { key },
        update: { flowJson: state as unknown as object },
        create: { key, flowJson: state as unknown as object },
      });
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error("setFlow failed:", err);
  }
}

export async function getFlow(key: string): Promise<FlowState | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const row = await prisma.conversation.findUnique({ where: { key } });
    await prisma.$disconnect();
    if (!row?.flowJson) return null;
    return row.flowJson as unknown as FlowState;
  } catch {
    return null;
  }
}
