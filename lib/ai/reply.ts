// lib/ai/reply.ts — 產生客服回覆（FAQ 優先 + 選配網搜 + 多輪脈絡）
import { chatCompletion } from "./client";
import { aiApiKey } from "./env";
import { loadFaq } from "./faq";
import { buildPersona } from "./persona";
import { generateWithWebSearch } from "./responses";
import { formatHistoryForPrompt, type ChatTurn } from "@/lib/chat/history";
import { DIALOGUE_CLOSING_REPLY, DIALOGUE_MAX } from "@/lib/chat/policy";
import type { Intent } from "./classify";

export interface ReplyContext {
  history?: ChatTurn[];
  dialogueRound?: number;
}

export async function generateReply(intent: Intent, text: string, ctx: ReplyContext = {}): Promise<string> {
  const { history = [], dialogueRound = 0 } = ctx;

  if (dialogueRound >= DIALOGUE_MAX) {
    return DIALOGUE_CLOSING_REPLY;
  }

  if (!aiApiKey()) {
    return fallbackReply(intent, dialogueRound);
  }

  const faq = await loadFaq();
  const persona = buildPersona();
  const historyBlock = formatHistoryForPrompt(history);

  const roundHint =
    dialogueRound >= DIALOGUE_MAX - 1
      ? "（這是本次對話最後一輪，請禮貌收尾，可提及還有其他客人需要招待。）"
      : dialogueRound > 0
        ? `（澄清對話第 ${dialogueRound} 輪，最多 ${DIALOGUE_MAX} 輪。）`
        : "";

  if (intent === "product") {
    const shopReply = await faqReply(persona, faq, text, historyBlock, roundHint);
    if (shopReply) return shopReply;

    const webReply = await generateWithWebSearch(text, faq, persona, historyBlock);
    if (webReply) return webReply;

    return fallbackReply("product", dialogueRound);
  }

  const taskHint = buildTaskHint(intent, dialogueRound);

  const messages = [
    { role: "system" as const, content: persona },
    {
      role: "user" as const,
      content: [
        `FAQ 資料：\n${faq}`,
        historyBlock ? `\n近期對話：\n${historyBlock}` : "",
        `\n本則訊息：${text}`,
        `意圖：${intent}`,
        roundHint,
        taskHint,
        "請回覆（繁體中文，簡短客氣）：",
      ].join("\n"),
    },
  ];

  try {
    const reply = await chatCompletion(messages, { thinkingDisabled: true });
    return reply.trim() || fallbackReply(intent, dialogueRound);
  } catch (err) {
    console.error("AI reply failed:", err);
    return fallbackReply(intent, dialogueRound);
  }
}

async function faqReply(
  persona: string,
  faq: string,
  text: string,
  historyBlock: string,
  roundHint: string
): Promise<string | null> {
  try {
    const messages = [
      { role: "system" as const, content: persona },
      {
        role: "user" as const,
        content: [
          `FAQ 資料：\n${faq}`,
          historyBlock ? `\n近期對話：\n${historyBlock}` : "",
          `\n客人問題：${text}`,
          roundHint,
          "請**只依 FAQ** 回答本店服務、價格、地址、營業時間。FAQ 無資料則改口請專人確認。",
          "若客人問題暗示想預約，結尾可禮貌引導「傳『預約』即可開啟表單」。",
          "繁體中文，簡短，不超過 4 句。",
        ].join("\n"),
      },
    ];
    const reply = await chatCompletion(messages, { thinkingDisabled: true });
    return reply.trim() || null;
  } catch {
    return null;
  }
}

function buildTaskHint(intent: Intent, dialogueRound: number): string {
  if (dialogueRound >= DIALOGUE_MAX - 1) {
    return "請禮貌收尾，並提及目前還有其他客人需要招待。";
  }
  switch (intent) {
    case "unknown":
      return "客人意圖不明確。請禮貌反問一個簡短澄清問題（例如：想預約、詢問服務、取消或更改預約？），不要一次問太多。";
    case "smalltalk":
      return "純閒聊時友善回應，並自然詢問是否需要預約或了解服務。";
    default:
      return "";
  }
}

function fallbackReply(intent: Intent, dialogueRound: number): string {
  if (dialogueRound >= DIALOGUE_MAX) return DIALOGUE_CLOSING_REPLY;

  switch (intent) {
    case "booking":
      return "好的！請在聊天室傳「預約」，我會為您開啟預約表單。";
    case "product":
      return "關於服務與價格：剪髮 800、燙髮 2000、染髮 1500、洗髮 350、護髮 200 元。地址與營業時間請見 FAQ，或傳「預約」開啟表單。";
    case "cancel":
      return "要取消預約嗎？請傳「取消預約」，我會列出您的預約供確認。";
    case "amend":
      return "要更改預約嗎？請傳「更改預約」，我會列出您的預約供確認。";
    case "unknown":
      return "請問您今天需要什麼協助呢？是想預約、詢問服務資訊，還是要取消或更改預約？";
    default:
      return "您好，我是花園漫步預約小幫手。傳「預約」開啟表單；有問題也歡迎直接詢問。";
  }
}
