// lib/ai/classify.ts — 意圖分類（AI 優先 + 對話脈絡 + 明確度）
import { chatCompletion } from "./client";
import { aiApiKey } from "./env";
import { formatHistoryForPrompt, type ChatTurn } from "@/lib/chat/history";

export type Intent = "booking" | "product" | "smalltalk" | "cancel" | "amend" | "unknown";
export type IntentConfidence = "clear" | "unclear";

export interface ClassifyResult {
  intent: Intent;
  confidence: IntentConfidence;
}

const VALID_INTENTS: Intent[] = ["booking", "product", "smalltalk", "cancel", "amend", "unknown"];

const KEYWORD_INTENTS: Array<{ intent: Intent; keywords: string[] }> = [
  { intent: "cancel", keywords: ["取消", "不去了", "去不了", "不想去了", "無法前來", "不能來", "去不成"] },
  { intent: "amend", keywords: ["更改", "修改", "改時間", "換時間", "換一天", "改到", "改天", "延後", "提前"] },
  { intent: "booking", keywords: ["預約", "訂位", "約時間", "想約", "排時間", "想剪", "想燙", "想染", "想洗", "想護"] },
  { intent: "product", keywords: ["多少錢", "價格", "價錢", "營業", "地址", "幾點", "設計師", "週二", "週三", "週四", "週五", "護髮"] },
  { intent: "smalltalk", keywords: ["你好", "嗨", "哈囉", "在嗎", "謝謝", "掰掰"] },
];

function keywordClassify(text: string): ClassifyResult {
  if (/有空|可約|能約|方便嗎|有空嗎/.test(text) && /明天|後天|后天|今天|今日|週|周|星期|\d{1,2}[\/\-\.]/.test(text)) {
    return { intent: "booking", confidence: "clear" };
  }
  for (const { intent, keywords } of KEYWORD_INTENTS) {
    if (keywords.some((k) => text.includes(k))) {
      const confidence: IntentConfidence =
        intent === "smalltalk" || text.length <= 4 ? "unclear" : "clear";
      return { intent, confidence };
    }
  }
  return { intent: "unknown", confidence: "unclear" };
}

export async function classifyIntent(text: string, history: ChatTurn[] = []): Promise<ClassifyResult> {
  if (aiApiKey()) {
    try {
      const historyBlock = formatHistoryForPrompt(history);
      const prompt = [
        "你是「花園漫步」美髮預約客服的意圖分類器。",
        "請**理解客人以自然語言表達的真實意圖**，結合近期對話脈絡，不要只抓表面關鍵字。",
        "",
        "意圖定義：",
        "- booking：想預約、安排時間、表達美髮需求（剪/燙/染/洗/護）",
        "- product：詢問服務、價格、營業、地址等本店資訊",
        "- cancel：想取消已成立的預約（含無法前來）",
        "- amend：想更改/修改預約",
        "- smalltalk：純打招呼、閒聊、無具體需求",
        "- unknown：語意模糊、資訊不足，需反問釐清",
        "",
        "confidence：",
        "- clear：語意足夠明確，可直接進入對應流程（開表單／FAQ 回答／取消更改）",
        "- unclear：語意不完整或需先澄清（例如只有「想」「明天」「可以嗎」、或打招呼後尚未說明需求）",
        "",
        "範例：",
        "- 「我想預約明天剪髮」→ booking, clear",
        "- 「你明天有空嗎」「週五可以約嗎」→ booking, clear",
        "- 「剪髮多少錢」→ product, clear",
        "- 「好的，幫我預約」且上一輪客服在問是否預約 → booking, clear",
        "- 「取消預約」→ cancel, clear",
        "",
        historyBlock ? `近期對話：\n${historyBlock}\n` : "",
        `本則訊息：${text}`,
        "",
        '只輸出 JSON（只輸出 json）：{"intent":"booking"|"product"|"smalltalk"|"cancel"|"amend"|"unknown","confidence":"clear"|"unclear"}',
      ].join("\n");

      const raw = await chatCompletion([{ role: "user", content: prompt }], { json: true, thinkingDisabled: true });
      const parsed = JSON.parse(raw);
      if (parsed?.intent && VALID_INTENTS.includes(parsed.intent)) {
        const confidence: IntentConfidence =
          parsed.confidence === "clear" ? "clear" : "unclear";
        return { intent: parsed.intent as Intent, confidence };
      }
    } catch (err) {
      console.error("classify failed, fallback to keywords:", err);
    }
  }

  return keywordClassify(text);
}

/** 將 unclear 的 booking/product 導向澄清流程 */
export function effectiveIntent(result: ClassifyResult): Intent {
  if (result.confidence === "unclear" && (result.intent === "booking" || result.intent === "product")) {
    return "unknown";
  }
  return result.intent;
}
