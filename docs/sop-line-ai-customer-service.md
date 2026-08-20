# LINE AI 客服系統 — 專案建構 SOP（Agent 提詞）

> **用途**：把本檔案連同（或複製）參考專案的 `docs/invariants.md`、`docs/phase-0-line-console.md`、`docs/setup-checklist.md` 一併提供給 Agent IDE，即可依 Phase 0～5 逐步複製出「LINE 官方帳號 + LIFF 訂單／預約 + AI 客服 + Railway 雲端部署」的完整系統。
>
> **Skill 包裝**：本檔亦內嵌於 Agent skill `line-bot-custom-service`（`references/sop.md`）。空白專案請先跑 skill 的 `scripts/bootstrap-docs.*`，再依本 SOP；預設 **策略 B 從零建構**。表單欄位以專案 `docs/form-schema.yaml` 為準（可為訂購或預約）。
>
> **參考實作**：`LineBot Reservation`（我的自然生活／果酵豆腐乳）。Agent 應以該架構為藍本，依「專案參數表」與 form-schema 客製化。
>
> **最後校訂**：2026-08-20（skill 打包）

---

## 一、可行性評估

### 1.1 為什麼可行

| 面向 | 說明 |
|---|---|
| **架構可複製** | Messaging API Webhook + LINE Login LIFF + Next.js App Router + Prisma MySQL + Railway，與官方帳號名稱／商品內容無強耦合。換帳號 = 換 env + 換 `docs/faq.md` + 換表單欄位語意。 |
| **外部設定可文件化** | LINE Console／OA Manager／Railway 的坑（LIFF scope、Developing 綁定、回應模式、Webhook 時效）已收斂在 `setup-checklist.md`，Agent 可照表驗證，不必每次重踩。 |
| **行為可契約化** | `invariants.md` 把「訂單只走 LIFF」「AI 不得亂編價格」「管理員不得任意 SQL」等寫成可驗證條目，複製時先填參數再改契約，可避免回歸。 |
| **AI 可替換** | `lib/ai/` 走 OpenAI 相容協定，換模型只需 env（`AI_BASE_URL`、`AI_CHAT_MODEL`），不需 fork 整個架構。 |
| **部署可腳本化** | GitHub → Railway、MySQL `${{MySQL.MYSQL_URL}}`、`prisma migrate deploy` 啟動流程已固定。 |

### 1.2 限制與前提（Agent 必須告知開發者）

1. **Phase 0 無法全自動**：Channel Secret、LIFF ID、Business ID 綁 LINE 帳號等必須人工在 LINE 後台操作；Agent 只能列出完整清單並用 API／CLI **查證**，不能代替點選。
2. **Developing vs Published**：Login Channel 在 Developing 時，只有 Admin／Tester 且已綁定 Business ID 的 LINE 能開 LIFF；要給一般客人用必須 Published（**不可改回 Developing**）。
3. **一 Provider 一組 Login**：每個官方帳號通常對應一組 Messaging API + 一組 LINE Login（LIFF 掛 Login，不掛 Messaging）。
4. **商品差異要改契約**：若新案不是「雙口味數量 + 地址選填」，必須同步改 Prisma schema、`lib/order/validate.ts`、LIFF 表單、`docs/faq.md` 與 `invariants.md`。
5. **金鑰永不進 repo**：只寫變數名稱與取得位置，不要求開發者把值貼進 Agent 對話。

### 1.3 建議複製策略（Agent 預設採用）

**策略 A（推薦）— Fork／Clone 參考 repo 後客製**

1. Clone 參考專案 → 改 `package.json` name、品牌文案、`docs/faq.md`、必要時改訂單欄位。
2. 新建 LINE Provider／Channel（Phase 0）。
3. 新建 GitHub repo + Railway 專案 + MySQL。
4. 填入 env，跑 migrate，依 Phase 5 驗收清單測試。

**策略 B — 從零依本 SOP 建構**

適用於要大幅改資料模型或技術棧時；仍須遵守各 Phase 的 invariants 與 setup-checklist 模式。

---

## 二、開始前：專案參數表（開發者填寫，Agent 讀取後代入）

Agent **不得**在未確認下列參數前寫死任何品牌專屬字串。

```yaml
# === 品牌與帳號 ===
brand_name: "我的自然生活"           # 對外顯示名稱
oa_display_name: "我的自然生活"      # LINE 官方帳號名稱
product_category: "果酵豆腐乳"       # 商品類別（寫入 AI persona）

# === 程式與部署 ===
github_owner: "chuwengming"
github_repo: "mynaturelife"
railway_project: "Line Reservation"
railway_web_service: "web"
node_version: ">=22"

# === 網域（Railway 部署後填入；Phase 0 可先用佔位 HTTPS）===
public_domain: "https://web-production-xxxx.up.railway.app"
webhook_path: "/api/line/webhook"
liff_path: "/liff/booking"          # 建議保留此路徑，避免 LINE Console 重設

# === 訂單語意 ===
order_terminology: "訂購"           # 全站用語：訂購/訂單（勿混用預約）
liff_form_fields:                   # 依商品調整
  - name
  - phone
  - order_date
  - order_item
  - plain_qty
  - spicy_qty
  - address_optional
  - notes_optional

# === AI ===
ai_provider: "deepseek"             # 或 openai 相容供應商
ai_chat_model: "deepseek-v4-flash"
ai_classify_model: "deepseek-v4-flash"
faq_source: "docs/faq.md"           # 本店事實唯一來源

# === 管理員 ===
admin_line_user_ids: ""             # Phase 1 後用「我的ID」取得，逗號分隔

# === 複製來源（策略 A）===
reference_repo: "chuwengming/mynaturelife"  # 或本機路徑
```

---

## 三、Agent 全局執行規則

在**任何 Phase** 開始前，Agent 必須：

1. **讀契約**：若專案已有 `docs/invariants.md` 則先讀；若無則在 Phase 1 可運行里程碑後**立即建立**（用本文「附錄 A」骨架）。
2. **讀設定權威**：`docs/setup-checklist.md` 為外部後台設定的唯一權威；新發現的設定項或錯誤成因**同一輪**補入該檔。
3. **外部設定一次講完**：凡需開發者到 LINE／Railway 後台操作，**一次列出該階段所有必要設定**（位置 → 要求值 → 漏掉後果），禁止擠牙膏。
4. **先查證再指示**：能用 API／CLI 查的（LIFF scope、webhook active、Railway 變數是否存在、`/api/health`）先查再說。
5. **Webhook 時效**：驗簽後 **立即 HTTP 200**；AI／通知／慢查詢用 `after()` 或背景 job，不得擋在 200 之前。
6. **禁止破壞 invariants**：優化建議須對照 `invariants.md`；與契約衝突者不得當必改。
7. **Phase 閘門**：每 Phase 結束須跑「開發者驗收清單」；未通過不得宣稱 Phase 完成。
8. **金鑰紀律**：只輸出變數名稱；禁止 commit `.env*`（除 `.env.example`）。

---

## Phase 0 — LINE 後台與金鑰（開發者為主，Agent 編清單與查證）

### 0.1 目標

取得 Messaging API、LINE Login、LIFF 所需金鑰與 ID；官方帳號可收 webhook；**尚未要求** Railway 一定已上線（LIFF Endpoint 可先用佔位 HTTPS）。

### 0.2 Agent 動作

1. 依 `docs/phase-0-line-console.md` 產出**本專案參數化版**清單（替換 `{{public_domain}}`、`{{brand_name}}`）。
2. 建立或更新 `docs/setup-checklist.md` 的「§0 專案固定事實」表格（GitHub、Railway、網域、LIFF ID 先留空或佔位）。
3. 建立 `.env.example`（若策略 B）或核對既有範本是否齊全。
4. **不要**要求開發者把 Secret／Token 貼進對話。

### 0.3 開發者必做清單（Agent 一次全給）

#### A. Messaging API Channel

| 步驟 | 位置 | 要求 | 漏掉後果 |
|---|---|---|---|
| 建立 Channel | [LINE Developers Console](https://developers.line.biz/console/) → Provider → Create → Messaging API | 名稱 = `{{oa_display_name}}` | 無 Bot |
| Channel secret | Basic settings | → `LINE_CHANNEL_SECRET` | Webhook 401 |
| Access token | Messaging API → Issue long-lived token | → `LINE_CHANNEL_ACCESS_TOKEN` | 無法 Reply/Push |
| 群組 | Allow bot to join group chats | **開啟** | 無法拉 Bot 進群 |
| Webhook | Use webhook + URL `{{public_domain}}{{webhook_path}}` | Phase 1 部署後 Verify | Bot 無事件 |

#### B. LINE Login Channel（LIFF 前置）

| 步驟 | 位置 | 要求 | 漏掉後果 |
|---|---|---|---|
| 建立 Login | 同一 Provider → LINE Login → Web app | 名稱可用 `{{oa_display_name}} Login` | 無 LIFF |
| LINE Login | Use LINE Login in your web app | **開啟** | LIFF 無法登入 |
| OpenID Connect | **開啟** | 無 ID Token | 無法驗身份 |
| Callback URL | `https://liff.line.me` + `{{public_domain}}` | 缺一外部瀏覽器登入失敗 |
| Linked OA | 連到 Messaging 官方帳號 | botPrompt 非 Off 時 init FORBIDDEN |
| Channel ID/Secret | Basic settings | → `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` | 後端驗證失敗 |

#### C. Business ID 綁定（Developing 測試必備）

Console 右上頭像 → Business ID Profile → **LINE 帳號** 綁定測試用手機 LINE。  
驗證：Messaging Channel Basic settings 出現 **Your user ID**（`U…`）。

#### D. LIFF App

| 設定 | 要求 | 漏掉後果 |
|---|---|---|
| Endpoint | `{{public_domain}}{{liff_path}}` | INVALID_CONFIG |
| Size | Tall 或 Full | 版面過小 |
| Scope openid | **必要** | 無 ID Token |
| Scope profile | 建議 | getProfile FORBIDDEN（仍可下單） |
| Add friend option | 不需引導 → **Off** | init FORBIDDEN |
| LIFF ID | → `NEXT_PUBLIC_LINE_LIFF_ID` | 頁面無法啟動 |

#### E. Official Account Manager

| 設定 | 要求 | 漏掉後果 |
|---|---|---|
| 回應功能 → **聊天** | **關閉** | 與 Bot 搶答 |
| Webhook | **開啟** | 無事件 |
| 加入好友歡迎訊息 | **關閉**（Bot 會發） | 雙重歡迎 |
| 自動回應／關鍵字 | **關閉** | 罐頭 + Bot 重複 |

#### F. 本機 env

複製 `.env.example` → `.env.local`，填入 Messaging Secret/Token、Login ID/Secret、LIFF ID（Admin 與 DATABASE 可後補）。

### 0.4 Phase 0 驗收（Agent 協助查證）

- [ ] `.env.local` 含 `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`（長度合理，不輸出值）
- [ ] `LINE_LOGIN_CHANNEL_ID`、`NEXT_PUBLIC_LINE_LIFF_ID` 已填
- [ ] LIFF ID 數字段 = Login Channel ID（不一致表示 LIFF 建錯 Channel）
- [ ] 開發者確認 OA Manager「聊天」已關、Webhook 已開

**Phase 0 完成標準**：金鑰齊全，文件已更新；Webhook Verify 可留到 Phase 1 有公開網域後。

---

## Phase 1 — 連線骨架（Webhook、驗簽、去重、基本回覆）

### 1.1 目標

Next.js 專案可本地／Railway 啟動；`POST /api/line/webhook` 驗簽成功、去重、能 Reply；1:1 傳「我的ID」可回 userId；follow 可回歡迎語。

### 1.2 Agent 技術清單（策略 A：對照參考 repo 補齊或確認）

| 項目 | 路徑／慣例 |
|---|---|
| Next.js App Router | `app/` |
| Webhook | `app/api/line/webhook/route.ts` |
| 驗簽 | Channel Secret + raw body HMAC-SHA256 |
| 去重 | `processed_events.webhook_event_id` 唯一 |
| 事件處理 | `lib/line/handle-events.ts` |
| LINE Client | `lib/line/client.ts`、`lib/line/messages.ts` |
| 環境讀取 | `lib/line/env.ts` |
| 健康檢查 | `app/api/health/route.ts` |
| Prisma | `prisma/schema.prisma` 至少含 `ProcessedEvent` |
| 契約 | 建立 `docs/invariants.md`（附錄 A） |

### 1.3 關鍵 invariants（Phase 1 必寫入契約）

- 未通過簽章驗證 → 401
- 驗簽後業務失敗仍 → HTTP 200（防 LINE 重送）
- Webhook 約 1 秒內回 200；慢工作不得擋在 200 前（Phase 3 起用 `after()`）
- 無 `DATABASE_URL` 時可略過去重（僅本機）；正式環境必須有 MySQL
- 「我的ID」只在 **1:1** 回傳 userId

### 1.4 開發者必做

1. （可選 Phase 1 末）建立 GitHub repo、Railway 專案、部署 web 服務。
2. Railway Variables：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`。
3. Messaging API Webhook URL 填上並 **Verify**。
4. 手機 LINE 1:1 傳任意字 → Bot 有回；傳「我的ID」→ 回 `U…`。

### 1.5 Phase 1 驗收

- [ ] `/api/health` 回 `hasChannelSecret`、`hasChannelAccessToken` 為 true
- [ ] Webhook Verify 成功
- [ ] 1:1 訊息有回覆
- [ ] `docs/invariants.md` 已建立
- [ ] `docs/setup-checklist.md` §1 Messaging API 已更新實測值

---

## Phase 2 — LIFF 訂單表單與 MySQL（送出即成立）

### 2.1 目標

LIFF 訂購表單可開啟、驗 ID Token、寫入 MySQL；訂單成立 Push 使用者與管理員；群組／1:1 傳「訂購」出現按鈕。

### 2.2 Agent 技術清單

| 項目 | 路徑／慣例 |
|---|---|
| LIFF 頁 | `app/liff/booking/page.tsx` + `order-form.tsx` |
| 訂單 API | `POST /api/orders` |
| ID Token 驗證 | `lib/line/verify-id-token.ts`（用 `LINE_LOGIN_CHANNEL_ID`） |
| 驗證邏輯 | `lib/order/validate.ts`（前後端共用規則） |
| 通知 | `lib/line/notify-order.ts` |
| LIFF 連結 | `lib/line/liff-link.ts` |
| DB | `users`、`orders`；migrate 可從 bookings 演進或新建 |
| Railway | `DATABASE_URL=${{MySQL.MYSQL_URL}}`；`railway.toml` healthcheck + migrate deploy |
| build | `package.json`: `"build": "prisma generate && next build"`, `"postinstall": "prisma generate"` |

### 2.3 關鍵 invariants（Phase 2 必寫入契約）

- **新建訂單只經 LIFF** `POST /api/orders`；聊天室不得直接 INSERT
- 通過驗證即 `status = confirmed`
- 後端驗 ID Token，不信任表單自填 userId
- LIFF `liff.init` 全程只呼叫一次；`withLoginOnExternalBrowser: true`
- LIFF 路徑 `{{liff_path}}` **不得**因改名而改動（除非同步改 LINE Console Endpoint）
- 地址依商品政策：本參考案為**一律選填**
- 驗證失敗 → 400 + 中文原因，不得產生 orders 列
- 1:1 新訂單 Push 給 `ADMIN_LINE_USER_IDS`

### 2.4 開發者必做

1. Railway 新增 MySQL；web 服務設 `DATABASE_URL` 參照。
2. 填入 `LINE_LOGIN_CHANNEL_ID`、`NEXT_PUBLIC_LINE_LIFF_ID`。
3. 1:1 傳「我的ID」→ 將 userId 填入 `ADMIN_LINE_USER_IDS`（Railway + 本機）。
4. LIFF Callback URL 含正式 `{{public_domain}}`。
5. Login Channel：自己測用 Developing；給客人用改 **Published**（不可回退）。
6. 從聊天室點「訂購」→ 填表 → 收到成立通知。

### 2.5 Phase 2 驗收

- [ ] `/api/health` → `databaseOk: true`
- [ ] LIFF 可登入、可送出、DB 有列
- [ ] 管理員收到 Push
- [ ] 缺欄位時表單與 API 皆顯示原因
- [ ] `docs/faq.md` 初版已建立（至少含訂購方式、欄位說明）
- [ ] `docs/setup-checklist.md` §3～§5 已填實際 LIFF ID、網域

---

## Phase 3 — AI 客服（意圖分類、FAQ、閒聊上限、可選搜尋）

### 3.1 目標

文字訊息經 AI 分類為 `order` / `product` / `smalltalk` / `cancel` / `amend`（後兩者 Phase 4 實作流程，Phase 3 可先分類）；產品問答依 `docs/faq.md`；閒聊 6 輪收尾 + 2 小時冷靜期；AI 掛掉時關鍵字 fallback。

### 3.2 Agent 技術清單

| 項目 | 路徑／慣例 |
|---|---|
| AI env/client | `lib/ai/env.ts`、`lib/ai/client.ts` |
| 分類 | `lib/ai/classify.ts` |
| FAQ 載入 | `lib/ai/faq.ts`（TTL cache） |
| Persona | `lib/ai/persona.ts` |
| 回覆 | `lib/ai/reply.ts` |
| 網路搜尋（選配） | `lib/ai/responses.ts`（DeepSeek `/responses` + web_search） |
| 關鍵字 fallback | `lib/chat/keywords.ts` |
| 對話狀態 | `conversations`、`chat_messages` |
| 閒聊政策 | `lib/chat/policy.ts`、`lib/chat/conversation.ts` |
| Webhook 背景 | `app/api/line/webhook/route.ts` 用 `after(handleWebhookEvents)` |

### 3.3 關鍵 invariants（Phase 3 必寫入契約）

- 意圖：`order` → 訂購按鈕；`product` → FAQ（+ 條件式搜尋）；`smalltalk` → 計輪
- **本店規格**（價格、成分、運費、保存）**只**能來自 `docs/faq.md`；`TODO` 項必須說請專人回覆
- 網路搜尋只用於與本店無關的一般知識；規格題不得搜尋
- `/chat/completions` 帶 `thinking: { type: "disabled" }`；json 模式提示詞須含「json」
- 純聊天 ≤ 6 輪；冷靜期 2 小時內只回明確訂購意圖
- 無 AI key：訂購/LIFF 正常，聊天改固定文案
- Reply 失敗 → Push **同一組** Message（含按鈕 template）

### 3.4 開發者必做

1. DeepSeek（或相容供應商）申請 API key → Railway `DEEPSEEK_API_KEY`。
2. 編輯 `docs/faq.md`：填入真實商品規格；`TODO` 留空項 Agent 會自動改口請專人回覆。
3. （可選）`AI_WEB_SEARCH=off` 關閉搜尋。

### 3.5 Phase 3 驗收

- [ ] `/api/health` → `hasAiKey: true`
- [ ] 「豆腐乳怎麼保存？」→ 依 FAQ
- [ ] 「訂購」→ 按鈕（關鍵字或 AI 皆可）
- [ ] 連續閒聊 6 句 → 禮貌收尾
- [ ] 關掉 AI key 重啟 → 訂購仍正常
- [ ] `docs/setup-checklist.md` §5.1 AI 已列

---

## Phase 4 — 管理員查庫 + 取消／更改訂單

### 4.1 目標

管理員在 **1:1** 用自然語言查銷量／客排名／訂單列表（固定 Prisma 查詢，非任意 SQL）；客人可聊天取消或更改**本人**訂單；群組改單綁 `speakerId`。

### 4.2 Agent 技術清單

| 項目 | 路徑／慣例 |
|---|---|
| 管理員解析 | `lib/admin/parse.ts` |
| 管理員查詢 | `lib/admin/query.ts` |
| 改單流程 | `lib/chat/amend.ts`、`lib/chat/flow.ts` |
| 訂單 patch | `lib/order/patch.ts`、`lib/order/period.ts` |
| 管理員判斷 | `lib/line/env.ts` → `isAdminLineUser` |
| 改單通知 | `lib/line/notify-order.ts` → `notifyOrderChanged` |
| flow 狀態 | `conversations.flow_json` 含 `speakerId` |

### 4.3 關鍵 invariants（Phase 4 必寫入契約）

- 管理員查庫：**僅 1:1** + userId ∈ `ADMIN_LINE_USER_IDS`；群組不查
- 不得任意 SQL；只允許 `lib/admin/query.ts` 內建工具
- 取消 → `status=cancelled`（不刪列）；更改 → 同新建驗證
- 只能改 `orders.line_user_id === event.source.userId`
- 群組 flow：`speakerId` 不符 → ignore 或 passthrough，不得清他人流程
- 「我的訂單／查訂單」≠ 開新表單；取消／更改優先於開表單
- 冷靜期內仍須處理 cancel/amend 與管理員查庫

### 4.4 開發者必做 — 新增管理員 SOP

對**每一位**新管理員（Agent 一次列出）：

1. 加官方帳號好友
2. 1:1 傳「我的ID」→ 取得 `U…`（**不要貼進 Agent 對話**）
3. Railway → `web` → `ADMIN_LINE_USER_IDS` 逗號追加
4. 等 redeploy
5. 1:1 傳「本月訂購總量」→ 有統計；非管理員傳同句 → 無統計

### 4.5 Phase 4 驗收

- [ ] 管理員 1:1 查詢有報表
- [ ] 群組同句無報表
- [ ] 「取消訂購」→ 確認 → DB status 更新
- [ ] 「更改訂購」→ 改數量 → 確認 → DB 更新
- [ ] 群組兩人同時改單不互相干擾
- [ ] FAQ 已說明取消／更改方式
- [ ] `docs/setup-checklist.md` §5.2 管理員 SOP 可用

---

## Phase 5 — 部署硬化、資料保留、文件同步、最終驗收

### 5.1 目標

Production 可長期運維；常見回歸已防；文件與程式一致。

### 5.2 Agent 技術清單（對照參考 repo 確認已實作）

| 項目 | 說明 |
|---|---|
| 訂單通知非阻塞 | `POST /api/orders` 成功先回 JSON，`notifyOrderConfirmed` 用 `after()` |
| Webhook 逐事件 try | 單則失敗不拖垮同批 |
| Reply → Push 完整訊息 | 含 template 按鈕 |
| 資料保留 | `processed_events` 7 天、`chat_messages` 30 天 → `lib/db/retention.ts` |
| Health 軟性 DB | `databaseOk` false 時 `ok` 仍 true |
| 關鍵字精細化 | `mentionsNewOrder` vs 查詢／取消／更改 |
| Admin 啟發式 | 不像報表不呼叫 AI |

### 5.3 開發者最終驗收（完整跑一輪）

依 `docs/setup-checklist.md` §6：

1. `/api/health` 旗標正常
2. Webhook Verify 成功
3. 1:1 任意字有回；「我的ID」有 U
4. 「訂購」→ LIFF → 成立
5. 產品 FAQ 問答
6. 取消／更改各走一輪
7. 管理員 1:1 查統計
8. 閒聊 6 輪收尾
9. OA Manager：聊天關、Webhook 開、歡迎訊息關

### 5.4 交付物清單（Agent 結案時確認）

- [ ] `docs/invariants.md` 與行為一致
- [ ] `docs/setup-checklist.md` 實測值已填
- [ ] `docs/phase-0-line-console.md` 網域已更新
- [ ] `docs/faq.md` 無不當 TODO（或 TODO 為刻意留空）
- [ ] `.env.example` 完整
- [ ] Railway 變數齊全（本機≠自動同步雲端）
- [ ] GitHub 已 push；Railway 部署綠燈

---

## 附錄 A — `docs/invariants.md` 新建骨架

Agent 在 Phase 1 第一個可運行里程碑**必須**建立，並隨 Phase 遞增填滿：

```markdown
# Project Invariants（可執行全局契約）

> 隨專案演進持續累積。每條應可被人工或 agent 驗證。
> 最後更新：YYYY-MM-DD

## 1. 產品流程
- [ ] （填：入口、訂單建立路徑、AI 意圖、閒聊上限…）

## 2. 模式／分支
- [ ] （填：1:1 vs 群組、管理員、LIFF 驗證…）

## 3. 環境與銜接
- [ ] （填：env 語意、Webhook/LIFF URL、AI 供應商、faq 權威來源…）

## 4. 資料與設定
- [ ] （填：表名、欄位、保留 TTL、單價常數…）

## 5. UI／跨頁契約
- [ ] （填：LIFF init、表單文案、錯誤訊息格式…）

## 6. 禁止破壞
- [ ] （填：驗簽、200 時效、禁止前端 secret、改單驗證…）

## 7. 待確認
- [ ] （填：尚未定案的商業規則）
```

---

## 附錄 B — `docs/setup-checklist.md` 必備章節

複製新案時保留結構，替換 §0 固定事實：

0. 專案固定事實（GitHub、Railway、網域、LIFF ID）
1. Messaging API Channel
2. Official Account Manager（**聊天關、Webhook 開**）
3. LINE Login Channel
4. LIFF App
5. Railway（含 env 表）
5.1 AI 對話
5.2 新增管理員
6. 驗證步驟
7. 錯誤代碼對照
8. 安全注意

---

## 附錄 C — 參考目錄結構

```
app/
  api/
    health/route.ts
    line/webhook/route.ts
    orders/route.ts
  liff/booking/
    page.tsx
    order-form.tsx
  layout.tsx
  page.tsx
docs/
  invariants.md
  setup-checklist.md
  phase-0-line-console.md
  faq.md
  sop-line-ai-customer-service.md   ← 本檔
lib/
  ai/          # classify, client, faq, persona, reply, responses
  admin/       # parse, query
  chat/        # amend, conversation, flow, keywords, policy
  db/          # prisma, retention
  line/        # client, env, handle-events, idempotency, liff-link, messages, notify-order, verify-id-token
  order/       # dates, format, options, patch, period, validate
prisma/
  schema.prisma
  migrations/
.env.example
railway.toml
```

---

## 附錄 D — 環境變數對照（複製時逐項確認）

| 變數 | Phase | 必要性 |
|---|---|---|
| `LINE_CHANNEL_SECRET` | 0/1 | 必要 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 0/1 | 必要 |
| `LINE_LOGIN_CHANNEL_ID` | 0/2 | 必要 |
| `LINE_LOGIN_CHANNEL_SECRET` | 0 | 選配（現行程式驗 token 只用 ID） |
| `NEXT_PUBLIC_LINE_LIFF_ID` | 0/2 | 必要 |
| `DATABASE_URL` | 2 | 必要（正式） |
| `ADMIN_LINE_USER_IDS` | 2 | 必要（通知+Phase4查庫） |
| `DEEPSEEK_API_KEY` | 3 | 必要（AI） |
| `AI_BASE_URL` | 3 | 選配 |
| `AI_CHAT_MODEL` | 3 | 選配 |
| `AI_CLASSIFY_MODEL` | 3 | 選配 |
| `AI_WEB_SEARCH` | 3 | 選配（off=只讀 FAQ） |

---

## 附錄 E — 常見錯誤速查（Agent 診斷用）

| 現象 | 優先檢查 |
|---|---|
| Webhook Verify 失敗 | 網域、服務是否 up、Secret 是否設 |
| LIFF FORBIDDEN init | Developing 未綁 LINE、botPrompt 非 Off、iframe 開啟 |
| LIFF FORBIDDEN profile | Scope 缺 profile（可忽略，不擋下單） |
| 雙重歡迎訊息 | OA Manager 歡迎訊息未關 |
| Bot 無回應但 Verify OK | OA「聊天」仍開 → 關閉 |
| AI 空回覆 | thinking 未 disabled |
| AI 400 json | 提示詞缺「json」字 |
| 訂單 503 | DATABASE_URL / MySQL |
| 管理員無報表 | 非 1:1 或不在 ADMIN_LINE_USER_IDS |

---

## 附錄 F — 給 Agent 的結案報告模板

每 Phase 結束向開發者回報：

```markdown
## Phase N 完成報告

### 已完成
- （列程式變更與文件更新）

### 契約變更
- （列 invariants 新增/修改標題；無則寫「無契約變更」）

### 請你現在操作（外部後台）
- （一次列完所有設定，含路徑→值→漏掉後果）

### 請你驗收
- （勾選清單）

### 下一 Phase 前置
- （尚缺 env、網域、Published 等）
```

---

## 使用方式（給開發者）

1. **複製本檔**到新 repo 的 `docs/`，或連同參考 repo 整包 clone。
2. 填寫「§二 專案參數表」。
3. 將以下檔案一併交給 Agent IDE：
   - `docs/sop-line-ai-customer-service.md`（本檔）
   - `docs/invariants.md`（若已有）
   - `docs/setup-checklist.md`、`docs/phase-0-line-console.md`（可為模板）
4. 指示 Agent：**「請依 SOP Phase 0 開始，採策略 A clone 參考 repo，品牌參數如下：…」**
5. 每 Phase 結束親跑驗收勾選，再指令「繼續 Phase N+1」。

---

*本 SOP 由「我的自然生活」LINE AI 客服專案結案經驗整理；後續若 invariants 或 setup-checklist 有新增條目，請同步修訂本檔對應 Phase。*
