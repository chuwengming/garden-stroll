// lib/ai/reply.ts — 產生客服回覆
import { chatCompletion } from "./client";
import { aiApiKey } from "./env";
import { loadFaq } from "./faq";
import { buildPersona } from "./persona";
import type { Intent } from "./classify";

export async function generateReply(intent: Intent, text: string, smalltalkCount: number): Promise<string> {
  if (!aiApiKey()) {
    return fallbackReply(intent);
  }

  const faq = await loadFaq();
  const persona = buildPersona();
  const smalltalkHint =
    smalltalkCount >= 5
      ? "（使用者閒聊已接近上限，請禮貌收尾並引導預約。）"
      : `（目前純聊天第 ${smalltalkCount} 輪，最多 6 輪。）`;

  const taskHint =
    intent === "unknown"
      ? "使用者意圖不明確。請禮貌地**反問**以釐清：他想預約、取消、更改預約，還是詢問服務？問一個簡短的澄清問題（選項式），不要一次問太多。"
      : "";

  const messages = [
    { role: "system" as const, content: persona },
    { role: "user" as const, content: `FAQ資料：\n${faq}\n\n使用者訊息：${text}\n意圖：${intent}\n${smalltalkHint}\n${taskHint}\n請回覆（繁體中文，簡短）：` },
  ];

  try {
    const reply = await chatCompletion(messages, { thinkingDisabled: true });
    return reply.trim() || fallbackReply(intent);
  } catch (err) {
    console.error("AI reply failed:", err);
    return fallbackReply(intent);
  }
}

function fallbackReply(intent: Intent): string {
  switch (intent) {
    case "booking":
      return "好的！請在聊天室傳「預約」，我會開啟預約表單。";
    case "product":
      return "關於服務與價格，歡迎參考預約表單中的選項（剪髮／燙髮／染髮／洗髮）。如需詳細資訊，我會請專人為您確認。";
    case "cancel":
      return "要取消預約嗎？請傳「取消預約」，我會列出您的預約讓您確認。";
    case "amend":
      return "要更改預約嗎？請傳「更改預約」，我會列出您的預約讓您確認。";
    case "unknown":
      return "請問您想做什麼呢？是要預約、取消預約、更改預約，還是詢問服務資訊？";
    default:
      return "您好，我是花園漫步預約小幫手。傳「預約」開啟表單；傳「我的ID」可查詢 LINE ID。";
  }
}
