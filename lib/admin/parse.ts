// lib/admin/parse.ts — 管理員自然語言解析
export type AdminQuery =
  | { kind: "total"; range: "month" | "last_month" | "today" }
  | { kind: "top_customers"; range: "month" | "last_month" }
  | { kind: "list"; range: "month" | "today"; limit?: number }
  | null;

const MONTH_PATTERNS = [
  { re: /上?個月|上月/, range: "last_month" as const },
  { re: /這個月|本月|這個月|當月/, range: "month" as const },
  { re: /今天|今日/, range: "today" as const },
];

export function parseAdminQuery(text: string): AdminQuery {
  const t = text.trim();

  // 客排名
  if (/(排名|排行榜|排行|top|最多|前幾名)/.test(t) && /(客|人|誰)/.test(t)) {
    const range = matchRange(t) ?? "month";
    if (range === "today") return { kind: "top_customers", range: "month" };
    return { kind: "top_customers", range };
  }

  // 列表
  if (/(列表|清單|列出|有哪些|幾筆|名單)/.test(t)) {
    const range = matchRange(t) ?? "month";
    return { kind: "list", range: range === "today" ? "today" : "month" };
  }

  // 總量 / 數量
  if (/(總量|總數|數量|幾筆|多少|統計|次數)/.test(t)) {
    const range = matchRange(t) ?? "month";
    return { kind: "total", range };
  }

  return null;
}

function matchRange(text: string): "month" | "last_month" | "today" | null {
  for (const { re, range } of MONTH_PATTERNS) {
    if (re.test(text)) return range;
  }
  return null;
}
