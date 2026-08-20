# Project Invariants（可執行全局契約）

> 隨專案演進持續累積。每條應可被人工或 agent 驗證（可檢查、可回歸）。
> 本檔由 `line-bot-custom-service` skill 的模板建立；維護規則見同目錄 `living-invariants` 說明（或 Cursor living-invariants rule）。
> 最後更新：2026-08-21

> **參數**：以專案 `docs/form-schema.yaml` 與 Intake 為準。本專案 **terminology = booking（預約）**。

## 1. 產品流程

- [ ] 使用者須加入 LINE 官方帳號「花園漫步」為好友，或被邀請進入有此官方帳號的群組，才能互動。
- [ ] 全站對外用語與 `docs/form-schema.yaml` 的 `terminology`／`form_noun` 一致（訂購或預約擇一為主，勿混用未宣告的同義詞當主流程）。
- [ ] 紀錄（訂單／預約）只經 LIFF 頁送出；**通過驗證即成立**（預設 `status = confirmed`）。聊天室不直接新建資料列。
- [ ] 群組或 1:1 文字由 AI 分類為建立意圖／產品諮詢／閒聊／取消／更改（意圖名稱可依 terminology 調整，但五類語意必須齊）。
- [ ] 明確「新建」關鍵字（見 form-schema `trigger_keywords`）直接開表單；取消／更改／查詢類句子**優先於**開表單，且不得誤開新單。
- [ ] **取消／更改**只能改「該則訊息發送者」自己的紀錄；取消改 status（不刪列）；更改通過與新建相同驗證後才寫入。進行中可說「算了／不用了」中止。
- [ ] 純聊天最多 6 輪；產品與開單意圖不計入。第 6 輪固定收尾並記 `closed_at`；其後冷靜期（預設 2 小時）內只回應明確開單關鍵字（取消／更改／管理員查庫仍須回應）。
- [ ] 加好友（follow）回歡迎訊息＋開表單按鈕。

## 2. 模式／分支

- [ ] 雙入口：1:1 回覆目標為 userId；群組為 groupId。每筆紀錄綁 `line_user_id`，無「目前使用者」全域變數。
- [ ] LIFF 送出後端須驗證 LINE ID Token，不得信任表單自填 userId。
- [ ] AI 不可用時退回關鍵字啟發式，不得完全不回覆；訂購／預約與表單不受影響。
- [ ] 對話狀態以對話為單位（userId／groupId／roomId）。群組取消／改單 `flow_json` 必須含 `speakerId`；非主人不得當成選號或清掉主人流程。
- [ ] 「我的ID」只在 1:1 回傳 userId。
- [ ] 管理員查庫僅 1:1 且 userId ∈ `ADMIN_LINE_USER_IDS`；不得任意 SQL，只允許固定 Prisma 查詢工具。

## 3. 環境與銜接

- [ ] 外部設定權威：`docs/setup-checklist.md`；新坑同輪補入。
- [ ] Messaging：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`。Login：`LINE_LOGIN_CHANNEL_ID`（驗 ID Token 必填）。兩組 Channel 不可混用；禁止寫死 repo。
- [ ] `NEXT_PUBLIC_LINE_LIFF_ID` 來自 Login Channel 的 LIFF App。
- [ ] Webhook：`POST /api/line/webhook`。LIFF 路徑以 checklist 為準（建議預設 `/liff/booking`，改路徑必同步 Console）。
- [ ] AI：OpenAI 相容；`DEEPSEEK_API_KEY` 或 `AI_API_KEY` + `AI_BASE_URL`／模型變數。無 key 時服務仍須啟動。
- [ ] `/chat/completions` 帶 `thinking: {type:"disabled"}`；`json_object` 時提示詞須含「json」。
- [ ] **本店／本服務資訊**唯一事實來源：`docs/faq.md`；`TODO` 項必須改口請專人回覆，不得臆測。
- [ ] 網路搜尋（若啟用）不得回答本店價格、規格、運費、付款、出貨等；失敗須退回只讀 FAQ。

## 4. 資料與設定

- [ ] Railway MySQL 為權威來源；`processed_events.webhook_event_id` 唯一。
- [ ] `conversations`／`chat_messages` 存在；processed_events 與 chat_messages 可設 TTL，不得破壞去重語意。
- [ ] 資料表與欄位以 `docs/form-schema.yaml` 為準（可為 orders 或 bookings）；驗證邏輯前後端共用。
- [ ] 必填／選填與成立條件寫在 form-schema，並反映於 invariants 本節。

## 5. UI／跨頁契約

- [ ] Next.js 同時提供 Webhook 與 LIFF。
- [ ] 僅 `NEXT_PUBLIC_LINE_LIFF_ID` 可進前端；Secret／Token 僅 server。
- [ ] `liff.init` 全程一次；允許 `withLoginOnExternalBrowser`。
- [ ] Scope：`openid` 必要；`profile` 選配，getProfile 失敗不得擋送出。
- [ ] LIFF 錯誤須標明階段（init／login／profile）與原始 code。
- [ ] 1:1 新單成立應 Push 給 `ADMIN_LINE_USER_IDS`。

## 6. 禁止破壞

- [ ] 未通過 `X-Line-Signature` → 401。
- [ ] 驗簽後業務／AI 失敗仍 → HTTP 200。
- [ ] Webhook 約 1 秒內 200；慢工作用 `after()`。
- [ ] Reply 失敗必須 Push **同一組** Message（含按鈕）。
- [ ] 每則 webhook 事件獨立 try；一則失敗不拖垮同批。
- [ ] 寫入 API 成功先回客戶端 JSON；LINE 通知用 `after()`。
- [ ] `/api/health` 的 `ok` 不因 MySQL ping 失敗而 false；另給 `databaseOk`。
- [ ] AI 語氣：客氣、繁中、短回覆、不催促、不宣稱療效、不在聊天室索取個資（導向表單）。
- [ ] 驗證失敗不得寫入 DB，須回中文原因。

## 7. 待確認

- [ ] 表單欄位最終清單（見 form-schema）。
- [ ] FAQ 缺項（各服務價格、付款方式、服務時長等）。
- [ ] Login Channel Developing vs Published。
- [ ] 群組是否每則都回，或僅 mention。
- [ ] 可預約日：僅週二至週五（見 form-schema `available_weekdays`）。
- [ ] 時段：9:00～16:00 每整點（見 form-schema `booking_slot`）。
- [ ] 同一時段是否限制可預約人數（防超收）。
