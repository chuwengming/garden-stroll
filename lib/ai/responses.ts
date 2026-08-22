// lib/ai/responses.ts — DeepSeek /responses + web_search（一般知識；本店規格禁搜）
import { aiApiKey, aiBaseUrl, aiChatModel, aiWebSearchEnabled } from "./env";

const SHOP_SPECIFIC =
  /(多少錢|價格|價錢|費用|營業|地址|在哪|幾點|電話|預約|取消|改時間|改預約|本店|店裡|設計師|週[一二三四五六日天]|營業時間|怎麼去|怎麼走|付款|現場)/;

export function isShopSpecificQuestion(text: string): boolean {
  return SHOP_SPECIFIC.test(text);
}

export async function generateWithWebSearch(
  userMessage: string,
  faq: string,
  persona: string,
  historyBlock: string
): Promise<string | null> {
  if (!aiWebSearchEnabled() || isShopSpecificQuestion(userMessage)) return null;

  const key = aiApiKey();
  if (!key) return null;

  const prompt = [
    persona,
    "",
    "FAQ（本店價格、地址、營業時間等**只能**引用 FAQ，不得搜尋或臆測）：",
    faq,
    historyBlock ? `\n近期對話：\n${historyBlock}\n` : "",
    `客人問題：${userMessage}`,
    "",
    "若 FAQ 能完整回答，請只用 FAQ。",
    "若為一般美髮知識且 FAQ 未涵蓋，可搜尋補充，並註明「以下為一般參考資訊」。",
    "不得用搜尋結果回答本店價格、地址、營業時間。",
    "繁體中文，簡短客氣，不超過 4 句。",
  ].join("\n");

  try {
    const body: Record<string, unknown> = {
      model: aiChatModel(),
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search" }],
      thinking: { type: "disabled" },
    };

    let res = await fetch(`${aiBaseUrl()}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok && res.status === 400) {
      const retryBody = { ...body };
      delete retryBody.thinking;
      res = await fetch(`${aiBaseUrl()}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(retryBody),
      });
    }

    if (!res.ok) return null;

    const data = await res.json();
    const text = extractResponseText(data);
    return text?.trim() || null;
  } catch (err) {
    console.error("web search failed:", err);
    return null;
  }
}

function extractResponseText(data: Record<string, unknown>): string | null {
  if (typeof data.output_text === "string") return data.output_text;
  const output = data.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.text === "string") return o.text;
        const content = o.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c && typeof c === "object" && (c as { type?: string }).type === "output_text") {
              const t = (c as { text?: string }).text;
              if (t) return t;
            }
          }
        }
      }
    }
  }
  return null;
}
