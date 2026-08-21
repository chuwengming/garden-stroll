// lib/admin/classify.ts — 管理員查庫意圖分流（AI 優先，規則為 fallback）
import { chatCompletion } from "@/lib/ai/client";
import { aiApiKey } from "@/lib/ai/env";
import { parseAdminQuery } from "./parse";

export type AdminQueryKind = "total" | "list" | "top_customers" | "detail";
export type AdminQueryRange = "month" | "last_month" | "today" | "all";

export interface AdminIntent {
  isAdminQuery: boolean;
  kind: AdminQueryKind;
  range: AdminQueryRange;
}

// AI 判斷管理員訊息是否為查庫請求
export async function classifyAdminIntent(text: string): Promise<AdminIntent> {
  // 1. AI 優先：理解自然語言（「請提供預約的資訊給我」「把預約列出來」「這週生意如何」）
  if (aiApiKey()) {
    try {
      const prompt = [
        "你是「花園漫步」美髮沙龍的**管理員意圖解析器**。",
        "使用者是店家管理員，在 1:1 對話中可能想「查詢預約資料」（查庫），也可能是一般客服對話。",
        "請判斷是否為查庫請求，並解析查詢種類與時間範圍。",
        "",
        "判斷原則：",
        "- 查庫請求 = 想看預約總量、預約列表、常客排名、營業統計、**某位預約者的詳細資料（電話等）**等**管理資料**。",
        "- 例如：「請提供預約的資訊」「把所有預約列出來」「這個月有幾筆」「誰預約最多」「今天生意如何」都是查庫。",
        "- **「某某的電話」「這位客人的聯絡方式」「預約 #3 的電話」「王小姐的電話」都是 detail（查單一預約/客人詳細資料）**。",
        "- 一般客服 = 預約、改期、取消、問價格、問營業資訊、閒聊等，**不是**查庫。",
        "- 「請提供預約的資訊給我」這類句子**是**查庫請求（管理員想看預約資料），不要誤判成預約。",
        "",
        "kind 定義：",
        "- total：統計總量／數量（幾筆、幾人、生意如何）",
        "- list：列出預約清單（有哪些、列出來、給我資訊）",
        "- top_customers：常客排名（誰最多、排名）",
        "- detail：查詢**特定**預約或客人的詳細資料（電話、預約內容、日期時段）——訊息中常含人名或預約編號",
        "",
        "range 定義（時間範圍）：",
        "- month：本月／這個月／近期（未指明時預設）",
        "- last_month：上月",
        "- today：今天／今日",
        "- all：不限時間（查特定預約/客人時用）",
        "",
        "只輸出以下 JSON（只輸出 json，不要其它文字）：{\"isAdminQuery\":true|false,\"kind\":\"total\"|\"list\"|\"top_customers\"|\"detail\",\"range\":\"month\"|\"last_month\"|\"today\"|\"all\"}",
        `管理員訊息：${text}`,
      ].join("\n");

      const raw = await chatCompletion(
        [{ role: "user", content: prompt }],
        { json: true, thinkingDisabled: true }
      );
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.isAdminQuery === "boolean" &&
        (parsed.isAdminQuery === false ||
          (["total", "list", "top_customers", "detail"].includes(parsed.kind) &&
            ["month", "last_month", "today", "all"].includes(parsed.range)))
      ) {
        return {
          isAdminQuery: parsed.isAdminQuery,
          kind: (parsed.kind ?? "list") as AdminQueryKind,
          range: (parsed.range ?? "month") as AdminQueryRange,
        };
      }
    } catch (err) {
      console.error("admin classify failed, fallback to rules:", err);
    }
  }

  // 2. 規則 fallback（無 AI key 或 AI 失敗）
  const rule = parseAdminQuery(text);
  if (rule) {
    return {
      isAdminQuery: true,
      kind: rule.kind,
      range: rule.range === "today" ? "today" : "month",
    };
  }
  return { isAdminQuery: false, kind: "list", range: "month" };
}
