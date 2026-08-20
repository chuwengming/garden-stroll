// lib/ai/faq.ts — docs/faq.md 載入（短 TTL 重讀）
import { readFile } from "fs/promises";
import { join } from "path";

let cache: { text: string; at: number } | null = null;
const TTL_MS = 60_000; // 1 分鐘

export async function loadFaq(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.text;
  const text = await readFile(join(process.cwd(), "docs", "faq.md"), "utf-8");
  cache = { text, at: now };
  return text;
}
