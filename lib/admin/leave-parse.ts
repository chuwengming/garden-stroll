// lib/admin/leave-parse.ts — 管理員請假語音解析
import { chatCompletion } from "@/lib/ai/client";
import { aiApiKey } from "@/lib/ai/env";

export interface LeaveIntent {
  isLeave: boolean;
  leaveDate: string;      // YYYY-MM-DD
  startTime: string | null; // null = 整天
  endTime: string | null;
  reason?: string;
  action: "add" | "remove" | "list" | null;
}

// AI 解析請假意圖（管理員 1:1）
export async function parseLeaveIntent(text: string, today: string): Promise<LeaveIntent | null> {
  if (aiApiKey()) {
    try {
      const prompt = [
        "你是花園漫步美髮沙龍的管理員請假解析器。使用者是店家管理員。",
        "請判斷是否為「設計師請假」相關請求，並解析。",
        "action：add=新增請假；remove=刪除請假；list=查詢請假。不是請假請求則回 isLeave=false。",
        "leaveDate：請假日期，格式 YYYY-MM-DD（今天是 " + today + "，若說「明天」「後天」請自行推算）。",
        "startTime/endTime：請假時段（HH:MM），整天請假則兩者皆 null。",
        "只輸出 JSON（只輸出 json）：{\"isLeave\":true|false,\"action\":\"add\"|\"remove\"|\"list\"|null,\"leaveDate\":\"YYYY-MM-DD\",\"startTime\":\"HH:MM\"|null,\"endTime\":\"HH:MM\"|null,\"reason\":\"...\"|null}",
        "管理員訊息：" + text,
      ].join("\\n");
      const raw = await chatCompletion([{ role: "user", content: prompt }], { json: true, thinkingDisabled: true });
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isLeave) {
        return {
          isLeave: true,
          action: parsed.action ?? "add",
          leaveDate: parsed.leaveDate ?? "",
          startTime: parsed.startTime ?? null,
          endTime: parsed.endTime ?? null,
          reason: parsed.reason ?? null,
        };
      }
      if (parsed && parsed.isLeave === false) return null;
    } catch (err) {
      console.error("leave parse failed:", err);
    }
  }
  return null;
}
