# Project Invariants（可執行全局契約）

> 隨專案演進持續累積。每條應可被人工或 agent 驗證（可檢查、可回歸）。
> 本檔由 `line-bot-custom-service` skill 的模板建立；維護規則依 DSH 全域規範 `~/.dsh/AGENTS.md` 與 `~/.dsh/rules/living-invariants.mdc`（living project invariants）。
> 最後更新：2026-08-22（意圖理解優化：confidence 分流、對話歷史、6 輪澄清、FAQ+網搜）

> **參數**：以專案 `docs/form-schema.yaml` 與 Intake 為準。本專案 **terminology = booking（預約）**。

## 1. 產品流程

- [x] 使用者須加入 LINE 官方帳號「花園漫步」為好友，或被邀請進入有此官方帳號的群組，才能互動。
- [x] 全站對外用語與 `docs/form-schema.yaml` 的 `terminology`／`form_noun` 一致（訂購或預約擇一為主，勿混用未宣告的同義詞當主流程）。
- [x] 紀錄（訂單／預約）只經 LIFF 頁送出；**通過驗證即成立**（預設 `status = confirmed`）。聊天室不直接新建資料列。
- [x] 群組或 1:1 文字由 AI 分類（**AI 優先 + 近期對話脈絡**；關鍵字僅 fallback）。分類含 **confidence**（clear／unclear）：clear 直接進流程；unclear 反問澄清。
- [x] **一次來回 = 一輪**；澄清對話（`unknown`／`smalltalk`）最多 **6 輪**；第 6 輪禮貌收尾（可提及還有其他客人需要招待）並記 `closed_at`。明確 **product 諮詢**與 **booking／cancel／amend 開單**不計入 6 輪。
- [x] 對話歷史存 `chat_messages`，供 classify／reply 讀取最近訊息（TTL 30 天）。
- [x] 取消／更改流程**智能匹配**：依使用者提到的服務項目／日期鎖定預約；單筆相符直接確認。
- [x] 明確「新建」關鍵字（見 form-schema `trigger_keywords`）直接開表單；取消／更改／查詢類句子**優先於**開表單，且不得誤開新單。
- [x] **取消／更改**只能改「該則訊息發送者」自己的紀錄；取消改 status（不刪列）；更改通過與新建相同驗證（含排程衝突）後才寫入。進行中可說「算了／不用了」中止。
- [x] 澄清／閒聊最多 6 輪（一次來回 = 一輪）；明確 product 諮詢與開單意圖不計入。第 6 輪禮貌收尾（可提及還有其他客人需要招待）並記 `closed_at`；其後冷靜期（預設 2 小時）內只回應明確開單關鍵字（取消／更改／管理員查庫仍須回應）。
- [x] 加好友（follow）回歡迎訊息＋開表單按鈕。
- [x] **Schedule v2 預約**：LIFF 可**複選**服務項目；選日期＋項目後呼叫 `/api/calendar`、`/api/availability` 顯示可預約日／時段；`end_time` 由後端依工時計算，不得晚於 17:00。
- [x] 衝突時 API 回中文原因，並可附替代時段；驗證失敗不得寫入 DB。

## 2. 模式／分支

- [x] 雙入口：1:1 回覆目標為 userId；群組為 groupId。每筆紀錄綁 `line_user_id`，無「目前使用者」全域變數。
- [x] LIFF 送出後端須驗證 LINE ID Token，不得信任表單自填 userId。
- [x] AI 不可用時退回關鍵字啟發式，不得完全不回覆；訂購／預約與表單不受影響。
- [x] 對話狀態以對話為單位（userId／groupId／roomId）。群組取消／改單 `flow_json` 必須含 `speakerId`；非主人不得當成選號或清掉主人流程。
- [x] 「我的ID」只在 1:1 回傳 userId。
- [x] 管理員查庫僅 1:1 且 userId ∈ `ADMIN_LINE_USER_IDS`；不得任意 SQL，只允許固定 Prisma 查詢工具。
- [x] **隱私**：預約資訊僅本人可查詢；非管理員查他人／全部預約 → 拒絕。
- [x] **引導**：AI 於使用者表達美髮需求時主動引導預約；**clear booking** 須先禮貌確認（「您要預約是嗎？請填寫預約表單」）再附表單；若訊息含日期且為非營業日，須禮貌說明並建議可預約日。
- [x] 「我的預約／查預約」列出本人預約；取消／更改優先於開表單。
- [x] 冷靜期內仍處理 cancel/amend 與管理員查庫。
- [x] **設計師請假**：管理員 1:1 以自然語新增／刪除／查詢請假（`designer_leaves`）；請假時段／整天須納入排程衝突檢查。

## 3. 環境與銜接

- [x] 外部設定權威：`docs/setup-checklist.md`；新坑同輪補入。
- [x] Messaging：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`。Login：`LINE_LOGIN_CHANNEL_ID`（驗 ID Token 必填）。兩組 Channel 不可混用；禁止寫死 repo。
- [x] `NEXT_PUBLIC_LINE_LIFF_ID` 來自 Login Channel 的 LIFF App。
- [x] Webhook：`POST /api/line/webhook`。LIFF 路徑以 checklist 為準（建議預設 `/liff/booking`，改路徑必同步 Console）。
- [x] AI：OpenAI 相容；`DEEPSEEK_API_KEY` 或 `AI_API_KEY` + `AI_BASE_URL`／模型變數。無 key 時服務仍須啟動。
- [x] `/chat/completions` 帶 `thinking: {type:"disabled"}`；`json_object` 時提示詞須含「json」。
- [x] **本店／本服務資訊**唯一事實來源：`docs/faq.md`；`TODO` 項必須改口請專人回覆，不得臆測。
- [x] 網路搜尋（若啟用）走 `lib/ai/responses.ts`（DeepSeek `/responses` + web_search）；**不得**回答本店價格、地址、營業時間等；失敗須退回只讀 FAQ 的 `/chat/completions`。
- [x] Cron 清理：獨立 `cron-retention` service（cronSchedule `0 0 * * *` UTC）+ `CRON_TOKEN` 保護；勿設在長駐 web server。

## 4. 資料與設定

- [x] Railway MySQL 為權威來源；`processed_events.webhook_event_id` 唯一。
- [x] `conversations`／`chat_messages` 存在；processed_events 與 chat_messages 可設 TTL，不得破壞去重語意。
- [x] 資料保留 TTL：`processed_events` 7 天、`chat_messages` 30 天（`lib/db/retention.ts`，可由 `/api/cron/retention` 觸發）。
- [x] 資料表與欄位以 `docs/form-schema.yaml` 為準；`bookings` 含 `start_time`、`end_time`、`items`（JSON 陣列）；`designer_leaves` 供請假。
- [x] 必填／選填與成立條件寫在 form-schema，並反映於 invariants 本節。
- [x] 欄位長度上限：name ≤ 50、notes ≤ 190（避免 VARCHAR(191) 溢位）。
- [x] **並行容量**（單設計師）：燙／染同時段最多 1 筆重服務；洗髮／護髮類同時段最多 2 人；剪髮時段不可並行洗髮／護髮；規則實作於 `lib/booking/schedule.ts`，變更須同步 form-schema `schedule.parallel_rules`。
- [x] **服務工時**以 form-schema `schedule.service_durations_minutes` 為準；實作於 `lib/booking/durations.ts`。
- [x] **可預約日**：僅週二至週五（`available_weekdays`）；開始時段 09:00～16:00 整點；營業結束 17:00。
- [x] **價格**（FAQ／form-schema `pricing`）：剪髮 800、燙髮 2000、染髮 1500、洗髮 350、護髮 200（TWD）。

## 5. UI／跨頁契約

- [x] Next.js 同時提供 Webhook 與 LIFF。
- [x] 僅 `NEXT_PUBLIC_LINE_LIFF_ID` 可進前端；Secret／Token 僅 server。
- [x] `liff.init` 全程一次；允許 `withLoginOnExternalBrowser`。
- [x] Scope：`openid` 必要；`profile` 選配，**getProfile 失敗不得擋送出**（獨立 try/catch 已實作）。
- [x] LIFF 錯誤須標明階段（init／login／profile）與原始 code。
- [x] 1:1 新單成立應 Push 給 `ADMIN_LINE_USER_IDS`。
- [x] LIFF 送出成功 → 完成畫面 + `closeWindow` 返回對話（明細由 Push 送達）。
- [x] LIFF 月曆：依 `/api/calendar` 顯示 open／partial／closed；選日後 `/api/availability` 載入可選 `start_time`。

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
- [x] **form-schema 與程式同步**：新增／變更服務項目、工時、容量規則、價格時，**同輪**更新 form-schema、FAQ、durations、schedule、LIFF 選項；不得程式有項、FAQ 無價（見 skill L14）。

## 7. 待確認

- [x] 表單欄位最終清單（見 form-schema，Schedule v2）。
- [x] FAQ 已填實：各服務價格（含護髮 200 元）、付款方式、服務時長、設計師聯絡、用品寄存（見 docs/faq.md）。
- [x] 可預約日：僅週二至週五。
- [x] 時段：動態開始時段 9:00～16:00，依項目計算結束時間，最晚 17:00。
- [x] 同一時段容量：依 `schedule.parallel_rules` 防超收（非單純人數上限）。
- [ ] Login Channel Developing vs Published。
- [ ] 群組是否每則都回，或僅 mention。
