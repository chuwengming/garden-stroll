// lib/ai/classify.ts — 意圖分類（AI 優先，無法確定時回 unknown 觸發反問）
import { chatCompletion } from "./client";
import { aiApiKey } from "./env";

export type Intent = "booking" | "product" | "smalltalk" | "cancel" | "amend" | "unknown";

// 僅在無 AI key 或 AI 失敗時使用
const KEYWORD_INTENTS: Array<{ intent: Intent; keywords: string[] }> = [
  { intent: "cancel", keywords: ["取消", "不去了", "去不了", "不想去了", "無法前來", "不能來", "去不成"] },
  { intent: "amend", keywords: ["更改", "修改", "改時間", "換時間", "換一天", "改到", "改天", "延後", "提前"] },
  { intent: "booking", keywords: ["預約", "訂位", "約時間", "想約", "排時間", "想剪", "想燙", "想染", "想洗"] },
  { intent: "product", keywords: ["多少錢", "價格", "價錢", "營業", "地址", "幾點", "設計師", "週二", "週三", "週四", "週五"] },
  { intent: "smalltalk", keywords: ["你好", "嗨", "哈囉", "在嗎", "謝謝", "掰掰"] },
];

export async function classifyIntent(text: string): Promise<Intent> {
  // 1. AI 優先：理解自然語言
  if (aiApiKey()) {
    try {
      const prompt = [
        "你是「花園漫步」美髮預約客服的意圖分類器。",
        "請**理解使用者以自然語言表達的真實意圖**，不要只抓表面關鍵字。同一意圖有很多種說法，例如：",
        "- 「我可以取消預約嗎？」「我8/25可能無法前來」「我想取消洗髮的預約」都是 cancel（取消預約）",
        "- 「我明天想燙頭髮」「想約時間剪髮」都是 booking（預約）",
        "- 「剪髮多少錢」「你們在哪」都是 product（詢問服務/資訊）",
        "意圖定義：",
        "- booking：想預約、安排時間、表達美髮需求",
        "- product：問服務、價格、營業資訊",
        "- cancel：想取消已成立的預約（含無法前來、去不了）",
        "- amend：想更改/修改/調整預約（改時間、改天）",
        "- smalltalk：純聊天、打招呼、無具體需求",
        "- unknown：訊息模糊、無法判斷使用者真正想做什麼（例如只有一個日期、或語意不完整）",
        "**重要**：只有當訊息確實模糊到無法判斷意圖時才輸出 unknown；能判斷時盡量輸出明確意圖。",
        "只輸出以下 JSON（只輸出 json，不要其它文字）：{\"intent\":\"booking\"|\"product\"|\"smalltalk\"|\"cancel\"|\"amend\"|\"unknown\"}",
        `訊息：${text}`,
      ].join("\n");
      const raw = await chatCompletion(
        [{ role: "user", content: prompt }],
        { json: true, thinkingDisabled: true }
      );
      const parsed = JSON.parse(raw);
      if (parsed?.intent && ["booking", "product", "smalltalk", "cancel", "amend", "unknown"].includes(parsed.intent)) {
        return parsed.intent as Intent;
      }
    } catch (err) {
      console.error("classify failed, fallback to keywords:", err);
    }
  }

  // 2. 關鍵字 fallback
  for (const { intent, keywords } of KEYWORD_INTENTS) {
    if (keywords.some((k) => text.includes(k))) return intent;
  }

  return "unknown";
}
