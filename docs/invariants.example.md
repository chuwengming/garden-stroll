# Project Invariants（可執行全局契約）

> 隨專案演進持續累積。每條應可被人工或 agent 驗證（可檢查、可回歸）。
> 最後更新：2026-08-20（stage-verifier 1–12 優化落地）

## 1. 產品流程

- [x] 使用者須加入 LINE 官方帳號「我的自然生活」為好友，或被邀請進入有此官方帳號的群組，才能互動。
- [x] 全站對外用語為「訂購／訂單」，不再使用「預約」。表單標題為「訂購表單」。
- [x] 訂單只經 LIFF 頁 `app/liff/booking/page.tsx` 送出；**通過驗證即成立**（`status = confirmed`）。聊天室不直接寫入訂單列。
- [x] 群組或 1:1 文字訊息由 AI 分類為 `order` / `product` / `smalltalk` / `cancel` / `amend`（`lib/ai/classify.ts`）。`order` 回訂購按鈕；`product` 依 FAQ 回答；`cancel`／`amend` 走對話改單流程；`smalltalk` 溫暖回應並計入閒聊輪數。
- [x] 訊息含明確「新訂購」關鍵字（訂購／下單／購買／我要買／預約，以及整句「訂單」或「我要訂單」）時直接判為 `order`。含「取消訂購／取消訂單」判為 `cancel`；含「更改／修改訂購」判為 `amend`。`我的訂單`、`查訂單`、`訂單到了沒` 視為查詢，**不得**開新表單。取消與更改與查詢**優先於**開表單詞。
- [x] **新建**訂單只經 LIFF `POST /api/orders`。聊天室不得新建訂單列。
- [x] **取消／更改**可經 1:1 或群組聊天，但只能改「該則訊息發送者」自己的訂單（`orders.line_user_id === event.source.userId`）。取消改 `status=cancelled`（不刪列）；更改通過與新建相同的欄位驗證後才寫入。流程：列出並確認該使用者訂單 → 詢問要改什麼 → 寫入後回覆新內容。進行中可說「算了／不用了」中止。
- [x] 純聊天最多 `SMALLTALK_TURN_LIMIT = 6` 輪；問產品與問訂購**不計入**。第 6 輪送出固定收尾訊息（理由為要照顧其他客人），並記 `closed_at`。
- [x] 收尾後進入 `COOLDOWN_MS = 2 小時` 冷靜期：期間只回應明確提到訂購的訊息，其他訊息完全不回；一旦回應訂購即清空輪數與 `closed_at`。
- [x] 加好友（follow）事件回歡迎訊息＋訂購按鈕。

## 2. 模式／分支（若有多模式、多角色、多入口）

- [x] 雙入口共用同一套後端與 `line_user_id`：1:1 回覆／Push 目標為該 `userId`；群組為該 `groupId`。
- [x] 多使用者並行：每筆訂單綁 `line_user_id`，不得使用「目前使用者」全域變數。
- [x] LIFF 送出時後端須驗證 LINE ID Token，不得信任表單自填的 userId。`POST /api/orders` 為唯一寫入點（舊 `POST /api/bookings` 已移除），成功列 `status = confirmed`。
- [x] 意圖分類由 AI 執行（Phase 3 起）；AI 不可用時退回關鍵字啟發式，不得因此完全不回覆。
- [x] Webhook 觸發表單的關鍵字：`訂購`、`下單`、`購買`、`我要買`，並保留 `預約`；整句「訂單」或「我要訂單」仍開表單。`我的訂單`／`查訂單` 不開表單。
- [x] 對話狀態以對話為單位：1:1 用 `userId`、群組用 `groupId`、多人聊天室用 `roomId`（`conversations.conversation_key`），不以個人為單位計算群組閒聊輪數。群組／聊天室的取消／改單 `flow_json` 必須帶 `speakerId`；非主人的回覆不得當成選號或確定，也不得清掉主人流程。
- [x] 「我的ID」只在 1:1 回傳 userId；群組／聊天室改口請到一對一查詢。
- [x] **管理員查庫**僅在 1:1、且 `event.source.userId` 屬於 `ADMIN_LINE_USER_IDS` 時執行。群組內即使管理員發言也不得輸出銷售報表。非管理員講同樣的話當一般客服處理，不得查庫。
- [x] 管理員自然語言不得變成任意 SQL。AI 只能產出允許的工具參數（期間、筆數、狀態、姓名關鍵字）；實際查詢由 `lib/admin/query.ts` 以 Prisma 執行。預設只統計 `status=confirmed`（含已更改未取消）。啟發式不得把「幾罐」當成全店統計；不像報表的句子不呼叫分類模型。

## 3. 環境與銜接（mock / simulation / real）

- [x] 外部後台（LINE／Railway）所有必要設定集中於 `docs/setup-checklist.md`，為設定的權威來源；新發現的設定項或錯誤成因須同輪補入。

- [x] Messaging API 金鑰：`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`。LIFF 另需 **LINE Login** Channel：`LINE_LOGIN_CHANNEL_ID`（驗 ID Token 必填）。`LINE_LOGIN_CHANNEL_SECRET` 可存但不參與目前的 ID Token 驗證。兩組 Channel 不可混用。禁止寫死在 repo。
- [x] `NEXT_PUBLIC_LINE_LIFF_ID` 來自 Login（或已啟用 Login 的）Channel → LIFF 分頁建立 App 後顯示的 LIFF ID。
- [x] `ADMIN_LINE_USER_IDS` 是管理員的 Messaging API `userId`（`U` 開頭），不是 Channel ID；Phase 1 在 1:1 傳「我的ID」可查詢。
- [x] Webhook 路徑固定：`POST /api/line/webhook`。正式 URL：`https://web-production-1ee6b.up.railway.app/api/line/webhook`。
- [x] LIFF Endpoint 路徑固定：`/liff/booking`（使用者已確認保留）。正式 URL：`https://web-production-1ee6b.up.railway.app/liff/booking`。**即使功能改名為訂購也不得更動此路徑**，否則 LINE Console 的 LIFF Endpoint 需重設並會出現 `INVALID_CONFIG`。
- [x] AI 供應商走 **OpenAI 相容協定**，只用三個變數決定：`DEEPSEEK_API_KEY`（或 `AI_API_KEY`）、`AI_BASE_URL`（預設 `https://api.deepseek.com`）、`AI_CHAT_MODEL`／`AI_CLASSIFY_MODEL`（預設 `deepseek-v4-flash`）。換供應商不得改動 `lib/ai/` 以外的程式。
- [x] 沒有 AI key 時服務仍須正常啟動：訂購與表單完全不受影響，聊天改回固定文案。
- [x] 呼叫 `/chat/completions` 一律帶 `thinking: {type:"disabled"}`。`/responses` 先帶同等欄位；若 API 回 400 再重試不帶 thinking。空內容必須立刻 fallback，不得空等。
- [x] 使用 `response_format: json_object` 時提示詞必須包含「json」字樣，否則 DeepSeek 回 400 `invalid_request_error`。
- [x] **本店資訊**的唯一事實來源是 `docs/faq.md`；標示 `TODO` 的項目視為無資料，AI 必須改口說請專人回覆，不得自行推測價格、成分、運費、出貨。
- [x] 網路搜尋只用於**與本店規格無關的一般知識**（吃法、料理、食材常識），且回覆須讓客人知道那是一般資訊。價格／成分／保存／重量等規格題**不得**呼叫 `/responses` 搜尋。搜尋結果**不得**用來回答本店價格、運費、罐重、成分、保存期限、付款與出貨。
- [x] 搜尋走 DeepSeek `/responses` 端點的伺服器端 `web_search`（`lib/ai/responses.ts`），共用同一把 `DEEPSEEK_API_KEY`，不再引入第三方搜尋服務金鑰。`/chat/completions` 沒有此工具。
- [x] `/responses` 失敗（400／逾時／模型不支援）時必須自動退回只讀 FAQ 的 `/chat/completions`，不得因搜尋失敗就不回覆。`AI_WEB_SEARCH=off` 可關閉搜尋。
- [x] **廢棄**：舊計畫「Phase 4 建 LLM-Wiki 知識庫並經 `retrieve(question)` 取用」→ 新做法「不另建知識庫，`docs/faq.md` 加網路搜尋即可」。不得再為此新增知識庫服務或 `retrieve` 介面。
- [x] 無 `DATABASE_URL` 時 webhook 仍可驗簽與回覆，但**略過去重**（僅本機過渡，正式環境必須有 MySQL）。

## 4. 資料與設定

- [x] Railway MySQL 為訂單與 webhook 去重的權威來源。
- [x] `processed_events.webhook_event_id` 唯一；同一事件重送不得重複 Reply／重複開 AI。
- [x] 對話狀態表 `conversations`（閒聊輪數、最後意圖、收尾時間、`flow_json` 含 `speakerId` 的取消／改單狀態）與歷史表 `chat_messages`。`processed_events` 保留 7 天、`chat_messages` 保留 30 天後可刪，不得改變 `webhook_event_id` 唯一語意。資料庫不可用時聊天仍要能回覆，只是不累計輪數、也不能改單。
- [x] 單價用於銷售金額試算：每罐 280 元（與 `docs/faq.md` 同步，常數 `PRICE_PER_JAR`）。運費不計入。
- [x] 訂單資料表為 `orders`（舊 `bookings` 由遷移 `20260819110000_bookings_to_orders` 更名，欄位 `booking_date`→`order_date`、`booking_item`→`order_item`，刪 `booking_slot`，新增 `plain_qty`、`spicy_qty`、`address`）。不得再新增 `bookings` 相關程式路徑。
- [x] 訂購欄位（v2）：姓名、聯絡電話、訂購日期、訂購項目、原味數量、辣味數量、地址、備註（選填）。**無時段欄位**。
- [x] 訂購日期允許「今天或之後」（台北時區），不得早於今天。

## 5. UI／跨頁／跨模組契約

- [x] Next.js 同時提供 Webhook 與 LIFF 頁。
- [x] Messaging Secret／Access Token 與 LINE Login Secret 只在 server；僅 `NEXT_PUBLIC_LINE_LIFF_ID` 可進 LIFF 頁。
- [x] LIFF 在外部瀏覽器以 `withLoginOnExternalBrowser` 初始化；`liff.init` 全程只呼叫一次，避免 React 重複掛載導致失敗。
- [x] LIFF Scope 只要求 **openid**；`profile` 為選配，`getProfile()` 失敗不得中斷訂購表單（顯示名稱僅用於預填）。
- [x] 訂購表單最上方必須顯示：`* 訂購6罐(含)以上者可以宅配(運費另計)，務必填寫地址`。
- [x] 1:1 新訂單除回使用者外，應 Push 給 `ADMIN_LINE_USER_IDS`（Phase 2）。通知內容含項目、兩種口味數量、合計、地址（若有）。
- [x] LIFF 錯誤訊息須標明失敗階段（init／login／profile）與 LINE 原始 code，便於排查。

## 6. 禁止破壞（含已修回歸）

- [x] 未通過 `X-Line-Signature`（HMAC-SHA256、raw body）不得處理事件；失敗回 401。
- [x] 驗簽後業務／AI 失敗仍回 HTTP 200，避免 LINE 重送同一事件。
- [x] Webhook 必須在約 1 秒內回 200；慢工作（AI、Wiki、搜尋）不得擋在 200 之前。實作方式：驗簽後用 `after()`（`next/server`）在回應之後才跑 `handleWebhookEvents`。
- [x] AI 回覆可能超過 Reply Token 時效，`respond()` 失敗時必須把**同一組** Message（含訂購按鈕 template）改用 Push，不得只補文字。
- [x] `handleWebhookEvents` 每一則事件的 claim 與處理都包在獨立 try；一則失敗不得讓同批其餘事件消失。HTTP 仍須先 200。
- [x] `POST /api/orders` 交易成功後先回 LIFF JSON，LINE 通知用 `after()`，不得把 Push 擋在成功回應之前。
- [x] `/api/health` 的 `ok` 不因 MySQL ping 失敗而變 false（避免 migrate 期間被 Railway 重啟）；另給軟性旗標 `databaseOk`。
- [x] AI 客服語氣契約：客氣、耐心、繁體中文、單次 3 句／約 120 字內、不得催促、不得宣稱療效、不得在聊天室索取姓名電話地址（一律導向表單）。
- [x] Reply Token 一次性；長回答改用 Push Message。群組互動 Push 到 groupId，不要只推給個人。
- [x] 不得把 Channel Secret／Access Token 打進前端 bundle。
- [x] **訂單成立條件**（任一不符即不得寫入資料庫，並須把原因回饋給使用者）：姓名有值；電話有值且格式有效；訂購項目有值；`原味數量` 與 `辣味數量` 至少一欄為大於 0 的整數。驗證邏輯集中在 `lib/order/validate.ts`，前端與 API 共用同一份。
- [x] 地址**一律選填**，任何數量都不得因缺地址而拒絕訂單（6 罐以上是「可以」宅配，不是一定要寄送）。合計 ≥ 6 且未填地址時，僅在管理員通知標註「未填地址」。
- [x] 驗證失敗時 `POST /api/orders` 回 400 並附中文原因清單，不得產生任何 `orders` 資料列。
- [x] 聊天改單驗證失敗時不得寫入，須把原因回給使用者並維持該筆為原資料。
- [x] 冷靜期內仍須回應「取消訂購／更改訂購」與管理員查庫，不得因閒聊收尾而忽略。

## 7. 待確認

- [x] 訂購項目選項：豆腐乳(原味) / 豆腐乳(辣味)（值：tofu_curd_plain / tofu_curd_spicy）。
- [ ] 「訂購項目」與兩個數量欄位語意重疊：目前項目僅作主要品項紀錄，數量以兩個欄位為準，不檢查兩者一致性。若需改為「所選項目數量必須 > 0」請告知。
- [ ] 單筆數量上限暫定每種口味 999；是否需要更嚴格上限或庫存檢查待確認。
- [x] `docs/faq.md` 已有本店規格：果酵豆腐乳、全素、無化學添加物、成分、600 ml／1100 g、每罐 280 元、保存 1 年、產地石岡萬墩街 112 號、食用與保存方式、醬汁可食與清炒建議。
- [x] 取消／更改訂單：客人在聊天說出後由 Bot 查明本人訂單並更新資料庫；FAQ 需說明此方式。
- [ ] FAQ 仍缺：運費金額、付款方式、出貨／可取貨時間、大量訂購或送禮包裝。缺項一律回「請專人回覆」。
- [ ] 管理員查庫目前為讀取報表（總量、客排名、訂單列表），不含管理員代客改單。若需要後者請再指定。
- [ ] 群組是否收全部訊息，或僅 mention 才處理（依 LINE Console 設定）。目前群組內每則文字訊息都會回覆，若太吵需改為只在被 mention 時回應。
