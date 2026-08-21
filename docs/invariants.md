# Project Invariants（可執行全局契約）

> 隨專案演進持續累積。每條應可被人工或 agent 驗證（可檢查、可回歸）。
> 本檔由 `line-bot-custom-service` skill 的模板建立；維護規則見同目錄 `living-invariants` 說明（或 Cursor living-invariants rule）。
> 最後更新：2026-08-21（Phase 5 完成 + Stage Verifier 修復：C1/M1/M2/M3 與 Minor 全數處理；FAQ 增修完成）

> **參數**：以專案 `docs/form-schema.yaml` 與 Intake 為準。本專案 **terminology = booking（預約）**。

## 1. 產品流程

- [ ] 使用者須加入 LINE 官方帳號「花園漫步」為好友，或被邀請進入有此官方帳號的群組，才能互動。
- [ ] 全站對外用語與 `docs/form-schema.yaml` 的 `terminology`／`form_noun` 一致（訂購或預約擇一為主，勿混用未宣告的同義詞當主流程）。
- [ ] 紀錄（訂單／預約）只經 LIFF 頁送出；**通過驗證即成立**（預設 `status = confirmed`）。聊天室不直接新建資料列。
- [x] 群組或 1:1 文字由 AI 分類（**AI 優先理解自然語言，關鍵字僅為 fallback**）；含 `unknown` 意圖：無法判斷時**反問澄清**（最多 6 輪對話）。
- [x] 取消／更改流程**智能匹配**：依使用者提到的服務項目／日期鎖定預約；單筆相符直接確認。
- [ ] 明確「新建」關鍵字（見 form-schema `trigger_keywords`）直接開表單；取消／更改／查詢類句子**優先於**開表單，且不得誤開新單。
- [ ] **取消／更改**只能改「該則訊息發送者」自己的紀錄；取消改 status（不刪列）；更改通過與新建相同驗證後才寫入。進行中可說「算了／不用了」中止。
- [ ] 純聊天最多 6 輪；產品與開單意圖不計入。第 6 輪固定收尾並記 `closed_at`；其後冷靜期（預設 2 小時）內只回應明確開單關鍵字（取消／更改／管理員查庫仍須回應）。
- [ ] 加好友（follow）回歡迎訊息＋開表單按鈕。

## 2. 模式／分支

- [ ] 雙入口：1:1 回覆目標為 userId；群組為 groupId。每筆紀錄綁 `line_user_id`，無「目前使用者」全域變數。
- [ ] LIFF 送出後端須驗證 LINE ID Token，不得信任表單自填 userId。
- [ ] AI 不可用時退回關鍵字啟發式，不得完全不回覆；訂購／預約與表單不受影響。
- [x] 對話狀態以對話為單位（userId／groupId／roomId）。群組取消／改單 `flow_json` 必須含 `speakerId`；非主人不得當成選號或清掉主人流程。
- [x] 「我的ID」只在 1:1 回傳 userId。
- [x] 管理員查庫僅 1:1 且 userId ∈ `ADMIN_LINE_USER_IDS`；不得任意 SQL，只允許固定 Prisma 查詢工具。
- [x] **隱私**：預約資訊僅本人可查詢；非管理員查他人／全部預約 → 拒絕。
- [x] **引導**：AI 於使用者表達美髮需求時主動引導預約（傳「預約」開表單）。
- [x] 「我的預約／查預約」列出本人預約；取消／更改優先於開表單。
- [x] 冷靜期內仍處理 cancel/amend 與管理員查庫。

## 3. 環境與銜接

- [x] 外部設定權威：`docs/setup-checklist.md`；新坑同輪補入。
- [x] Messaging：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`。Login：`LINE_LOGIN_CHANNEL_ID`（驗 ID Token 必填）。兩組 Channel 不可混用；禁止寫死 repo。
- [x] `NEXT_PUBLIC_LINE_LIFF_ID` 來自 Login Channel 的 LIFF App。
- [x] Webhook：`POST /api/line/webhook`。LIFF 路徑以 checklist 為準（建議預設 `/liff/booking`，改路徑必同步 Console）。
- [x] AI：OpenAI 相容；`DEEPSEEK_API_KEY` 或 `AI_API_KEY` + `AI_BASE_URL`／模型變數。無 key 時服務仍須啟動。
- [x] `/chat/completions` 帶 `thinking: {type:"disabled"}`；`json_object` 時提示詞須含「json」。
- [x] **本店／本服務資訊**唯一事實來源：`docs/faq.md`；`TODO` 項必須改口請專人回覆，不得臆測。
- [x] 網路搜尋（若啟用）不得回答本店價格、規格、運費、付款、出貨等；失敗須退回只讀 FAQ。
- [x] Cron 清理：獨立 `cron-retention` service（cronSchedule `0 0 * * *` UTC）+ `CRON_TOKEN` 保護；勿設在長駐 web server。

## 4. 資料與設定

- [x] Railway MySQL 為權威來源；`processed_events.webhook_event_id` 唯一。
- [x] `conversations`／`chat_messages` 存在；processed_events 與 chat_messages 可設 TTL，不得破壞去重語意。
- [x] 資料保留 TTL：`processed_events` 7 天、`chat_messages` 30 天（`lib/db/retention.ts`，可由 `/api/cron/retention` 觸發）。
- [x] 資料表與欄位以 `docs/form-schema.yaml` 為準（可為 orders 或 bookings）；驗證邏輯前後端共用。
- [x] 必填／選填與成立條件寫在 form-schema，並反映於 invariants 本節。
- [x] 欄位長度上限：name ≤ 50、notes ≤ 190（避免 VARCHAR(191) 溢位）。

## 5. UI／跨頁契約

- [x] Next.js 同時提供 Webhook 與 LIFF。
- [x] 僅 `NEXT_PUBLIC_LINE_LIFF_ID` 可進前端；Secret／Token 僅 server。
- [x] `liff.init` 全程一次；允許 `withLoginOnExternalBrowser`。
- [x] Scope：`openid` 必要；`profile` 選配，**getProfile 失敗不得擋送出**（獨立 try/catch 已實作）。
- [x] LIFF 錯誤須標明階段（init／login／profile）與原始 code。
- [x] 1:1 新單成立應 Push 給 `ADMIN_LINE_USER_IDS`。
- [x] LIFF 送出成功 → 完成畫面 + `closeWindow` 返回對話（明細由 Push 送達）。

## 6. 禁止破壞

- [x] 未通過 `X-Line-Signature` → 401。
- [x] 驗簽後業務／AI 失敗仍 → HTTP 200。
- [x] Webhook 約 1 秒內 200；慢工作用 `after()`。
- [x] Reply 失敗必須 Push **同一組** Message（含按鈕）→ 已實作 `replyOrPush`。
- [x] 每則 webhook 事件獨立 try；一則失敗不拖垮同批。
- [x] 寫入 API 成功先回客戶端 JSON；LINE 通知用 `after()`。
- [x] `/api/health` 的 `ok` 不因 MySQL ping 失敗而 false；另給 `databaseOk`。
- [x] AI 語氣：客氣、繁中、短回覆、不催促、不宣稱療效、不在聊天室索取個資（導向表單）。
- [x] 驗證失敗不得寫入 DB，須回中文原因。
- [x] **ID Token 驗證**：必須用 ES256 + JWKS（`api.line.me/oauth2/v2.1/certs`）；不得改回 HS256 + channel secret（會 401）。
- [x] **LIFF getProfile 失敗不得擋送出**：getProfile 必須獨立 try/catch，失敗僅失去自動帶入姓名，表單照常渲染。
- [x] **取消/更改流程編號**：select 步驟必須用 `flow.options`（顯示清單順序）對應編號；不得重新抓未匹配清單（會選錯預約）。
- [x] **流程防卡死**：select 收到非編號輸入 → 自動退出流程；flow 5 分鐘超時自動清除。
- [x] **keywordIntent 順序**：cancel/amend/query 必須先於泛化「預約」判斷，否則「取消預約」被誤判為 booking。
- [x] **管理員查庫關鍵字**：不得含「多少／數量」（「剪髮多少錢」會被誤判為總量報表）；只用 `總量|總數|幾筆|統計|次數`。
- [x] **`/api/cron/retention` 授權**：`CRON_TOKEN` 必設且比對一致才執行（fail-closed）；未設 token 一律 401。
- [x] **日期曆法**：`YYYY-MM-DD` 須為真實曆法日期（`isValidCalendarDate`），不得靠 `Date` 自動 rollover（2026-02-31 → 3/3）。

## 7. 待確認

- [x] 表單欄位最終清單（見 form-schema）。
- [x] FAQ 已填實：各服務價格、付款方式、服務時長說明、設計師聯絡、用品寄存服務（見 docs/faq.md）。
- [ ] Login Channel Developing vs Published。
- [ ] 群組是否每則都回，或僅 mention。
- [ ] 可預約日：僅週二至週五（見 form-schema `available_weekdays`）。
- [ ] 時段：9:00～16:00 每整點（見 form-schema `booking_slot`）。
- [ ] 同一時段是否限制可預約人數（防超收）。
