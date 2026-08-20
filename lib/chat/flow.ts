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
  /** select 步驟顯示的清單（bookingId 依顯示順序）— 供編號對應，避免錯位 */
  options?: number[];
}

const FLOW_TIMEOUT_MS = 5 * 60 * 1000; // 5 分鐘無動作自動失效

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
    const flow = row.flowJson as unknown as FlowState;
    // 過期自動清除
    if (flow && typeof flow.createdAt === "number" && Date.now() - flow.createdAt > FLOW_TIMEOUT_MS) {
      await setFlow(key, null);
      return null;
    }
    return flow;
  } catch {
    return null;
  }
}
