// lib/admin/parse.ts — 管理員自然語言解析（規則 fallback）
export type AdminQuery =
  | { kind: "total"; range: "month" | "last_month" | "today" }
  | { kind: "top_customers"; range: "month" | "last_month" }
  | { kind: "list"; range: "month" | "today"; limit?: number }
  | { kind: "detail"; range: "all" }
  | null;

const MONTH_PATTERNS = [
  { re: /上?個月|上月/, range: "last_month" as const },
  { re: /這個月|本月|當月/, range: "month" as const },
  { re: /今天|今日/, range: "today" as const },
];

export function parseAdminQuery(text: string): AdminQuery {
  const t = text.trim();

  // 特定客人／編號／電話查詢
  if (
    /(電話|手機|聯絡方式|聯絡)/.test(t) ||
    /#\s*\d+/.test(t) ||
    /預約\s*#?\s*\d+/.test(t) ||
    (/([\u4e00-\u9fff]{2,4})(?:小姐|先生)/.test(t) && !/(列表|清單|全部)/.test(t))
  ) {
    return { kind: "detail", range: "all" };
  }

  // 客排名
  if (/(排名|排行榜|排行|top|最多|前幾名)/.test(t) && /(客|人|誰)/.test(t)) {
    const range = matchRange(t) ?? "month";
    if (range === "today") return { kind: "top_customers", range: "month" };
    return { kind: "top_customers", range };
  }

  // 列表／提供預約資訊
  if (/(列表|清單|列出|有哪些|名單|提供.*預約|預約.*資訊|預約.*資料|給我.*預約)/.test(t)) {
    const range = matchRange(t) ?? "month";
    return { kind: "list", range: range === "today" ? "today" : "month" };
  }

  // 總量（避免「剪髮多少錢」誤判）
  if (/(總量|總數|幾筆|統計|次數|共幾|累計)/.test(t)) {
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
