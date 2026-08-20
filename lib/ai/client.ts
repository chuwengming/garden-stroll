// lib/ai/client.ts — OpenAI 相容 HTTP client
import { aiApiKey, aiBaseUrl, aiChatModel } from "./env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { json?: boolean; thinkingDisabled?: boolean } = {}
): Promise<string> {
  const key = aiApiKey();
  if (!key) throw new Error("No AI API key configured");

  const body: Record<string, unknown> = {
    model: aiChatModel(),
    messages,
    temperature: 0.4,
    max_tokens: 1000,
  };
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }
  if (opts.thinkingDisabled) {
    body.thinking = { type: "disabled" };
  }

  const res = await fetch(`${aiBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
