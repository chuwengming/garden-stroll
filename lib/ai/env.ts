// lib/ai/env.ts — AI 環境變數
export function aiApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY;
}

export function aiBaseUrl(): string {
  return process.env.AI_BASE_URL ?? "https://api.deepseek.com";
}

export function aiChatModel(): string {
  return process.env.AI_CHAT_MODEL ?? "deepseek-v4-flash";
}

export function aiWebSearchEnabled(): boolean {
  return (process.env.AI_WEB_SEARCH ?? "on").toLowerCase() !== "off";
}

export function hasAiKey(): boolean {
  return Boolean(aiApiKey());
}
