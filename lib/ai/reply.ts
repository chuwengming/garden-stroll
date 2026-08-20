// lib/ai/reply.ts — 產生客服回覆
import { chatCompletion } from "./client";
import { aiApiKey } from "./env";
import { loadFaq } from "./faq";
import { buildPersona } from "./persona";
import type { Intent } from "./classify";

export async function generateReply(intent: Intent, text: string, smalltalkCount: number): Promise<string> {
  if (!aiApiKey()) {
    // 無 AI key fallback：固定文案（invariants §3）
    return fallbackReply(intent);
  }

  const faq = await loadFaq();
  const persona = buildPersona();
  const smalltalkHint =
    smalltalkCount >= 5
      ? "（使用者閒聊已接近上限，請禮貌收尾並引導預約。）"
      : `（目前純聊天第 ${smalltalkCount} 輪，最多 6 輪。）`;

  const messages = [
    { role: "system" as const, content: persona },
    { role: "user" as const, content: `FAQ資料：\n${faq}\n\n使用者訊息：${text}\n意圖：${intent}\n${smalltalkHint}\n請回覆（繁體中文，簡短）：` },
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
      return "關於服務內容，歡迎參考預約表單中的選項（剪髮／燙髮／染髮／洗髮）。詳細價格請稍候，我會請專人為您確認。";
    case "cancel":
      return "要取消預約嗎？請傳「取消預約」，我會列出您的預約讓您確認。";
    case "amend":
      return "要更改預約嗎？請傳「更改預約」，我會列出您的預約讓您確認。";
    default:
      return "您好，我是花園漫步預約小幫手。傳「預約」開啟表單；傳「我的ID」可查詢 LINE ID。";
  }
}
