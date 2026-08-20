// lib/ai/classify.ts — 意圖分類（AI 優先，關鍵字僅為 fallback）
import { chatCompletion } from "./client";
import { aiApiKey } from "./env";

export type Intent = "booking" | "product" | "smalltalk" | "cancel" | "amend" | "unknown";

// 僅在無 AI key 或 AI 失敗時使用
const KEYWORD_INTENTS: Array<{ intent: Intent; keywords: string[] }> = [
  { intent: "booking", keywords: ["預約", "我要預約", "預約服務", "訂位", "約時間", "想約", "排時間"] },
  { intent: "cancel", keywords: ["取消預約", "取消", "不去了", "改天", "去不了"] },
  { intent: "amend", keywords: ["更改預約", "修改預約", "改預約", "換時間", "改時間"] },
  { intent: "product", keywords: ["剪髮", "燙髮", "染髮", "洗髮", "價格", "多少錢", "營業", "地址", "幾點", "週二", "週三", "週四", "週五", "設計師"] },
  { intent: "smalltalk", keywords: ["你好", "嗨", "哈囉", "在嗎", "謝謝", "掰掰"] },
];

export async function classifyIntent(text: string): Promise<Intent> {
  // 1. AI 優先：理解自然語言，不靠死板關鍵字
  if (aiApiKey()) {
    try {
      const prompt = [
        "你是「花園漫步」美髮預約客服的意圖分類器。",
        "請**理解使用者以自然語言表達的真實意圖**，不要只抓表面關鍵字。",
        "意圖定義：",
        "- booking：想要預約、訂位、安排時間（含「明天可以嗎」「我想剪頭髮」這類需求表達）",
        "- product：詢問服務、價格、營業資訊、商品細節",
        "- cancel：想要取消已成立的預約（含「我不去了」「那天有事」）",
        "- amend：想要更改/修改預約（含「改到明天」「換個時間」）",
        "- smalltalk：純聊天、打招呼、無具體需求",
        "只輸出以下 JSON（只輸出 json，不要其它文字）：{\"intent\":\"booking\"|\"product\"|\"smalltalk\"|\"cancel\"|\"amend\"}",
        `訊息：${text}`,
      ].join("\n");
      const raw = await chatCompletion(
        [{ role: "user", content: prompt }],
        { json: true, thinkingDisabled: true }
      );
      const parsed = JSON.parse(raw);
      if (parsed?.intent && ["booking", "product", "smalltalk", "cancel", "amend"].includes(parsed.intent)) {
        return parsed.intent as Intent;
      }
    } catch (err) {
      console.error("classify failed, fallback to keywords:", err);
    }
  }

  // 2. 關鍵字 fallback（無 AI key 或 AI 失敗）
  for (const { intent, keywords } of KEYWORD_INTENTS) {
    if (keywords.some((k) => text.includes(k))) return intent;
  }

  return "smalltalk";
}
