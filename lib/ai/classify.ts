// lib/ai/classify.ts — 意圖分類
import { chatCompletion } from "./client";
import { aiClassifyModel, aiApiKey } from "./env";

export type Intent = "booking" | "product" | "smalltalk" | "cancel" | "amend" | "unknown";

const KEYWORD_INTENTS: Array<{ intent: Intent; keywords: string[] }> = [
  { intent: "cancel", keywords: ["取消預約", "取消", "不去了", "改天"] },
  { intent: "amend", keywords: ["更改預約", "修改預約", "改預約", "換時間"] },
  { intent: "booking", keywords: ["預約", "我要預約", "預約服務", "訂位", "約時間"] },
  { intent: "product", keywords: ["剪髮", "燙髮", "染髮", "洗髮", "價格", "多少錢", "營業", "地址", "幾點", "週二", "週三", "週四", "週五"] },
  { intent: "smalltalk", keywords: ["你好", "嗨", "哈囉", "在嗎", "謝謝", "掰掰"] },
];

export async function classifyIntent(text: string): Promise<Intent> {
  // 1. 關鍵字快速判定（無 AI key 時也能運作）
  for (const { intent, keywords } of KEYWORD_INTENTS) {
    if (keywords.some((k) => text.includes(k))) return intent;
  }

  // 2. AI 分類（json 提示含「json」）
  if (aiApiKey()) {
    try {
      const prompt = `你是一個 LINE 美髮預約客服的意圖分類器。將使用者訊息分類為以下 JSON 之一（只輸出 json）：{"intent":"booking"|"product"|"smalltalk"|"cancel"|"amend"}
訊息：${text}`;
      const raw = await chatCompletion(
        [{ role: "user", content: prompt }],
        { json: true, thinkingDisabled: true }
      );
      const parsed = JSON.parse(raw);
      if (parsed?.intent && ["booking", "product", "smalltalk", "cancel", "amend"].includes(parsed.intent)) {
        return parsed.intent as Intent;
      }
    } catch (err) {
      console.error("classify failed, fallback to smalltalk:", err);
    }
  }

  return "smalltalk";
}
