# 完整設定清單（LINE / Railway / GitHub）

一份到位的設定總表。**所有**需要人工在後台點選的項目都列在這裡，含「為什麼需要」與「漏了會出現什麼錯誤」。
金鑰值不寫在本檔，只寫變數名稱與取得位置。

> **Skill 模板注意**：下列「§0 專案固定事實」若仍是「我的自然生活／既有 Railway 網域」，代表尚未替換。**新專案必須在 Intake／Phase 1 部署後改成自己的值**；勿照抄參考案的 LIFF ID／網域。

最後驗證：YYYY-MM-DD（請改為實際驗證日）

---

## 0. 專案固定事實

| 項目 | 值 |
|---|---|
| 官方帳號 | 花園漫步（basic ID 部署後填） |
| GitHub | `chuwengming/garden-stroll` |
| Railway 專案 | Line Reservation |
| Railway 服務 | `web`（Next.js）、`MySQL` |
| 公開網域 | `https://{{public_host}}`（Railway 部署後回填） |
| Webhook URL | `https://{{public_host}}/api/line/webhook` |
| LIFF Endpoint | `https://{{public_host}}/liff/booking`（路徑以 form-schema `liff_path` 為準） |
| LIFF ID | （建立 LIFF 後填） |
| LINE Login Channel ID | （Login Channel Basic settings） |

> 本專案 Intake 已確認：預約系統（booking）、美髮服務、僅週二～週五營業。

LIFF ID 的數字段必須等於 Login Channel ID；不相等表示 LIFF 建在別的 Channel 下。

---

## 1. LINE Developers：Messaging API Channel

位置：[LINE Developers Console](https://developers.line.biz/console/) → Provider → Messaging API Channel「花園漫步」

| 設定 | 要求值 | 漏掉的後果 |
|---|---|---|
| Basic settings → **Channel secret** | 複製到 `LINE_CHANNEL_SECRET` | webhook 驗簽永遠 401 |
| Messaging API → **Channel access token（長期）** | 複製到 `LINE_CHANNEL_ACCESS_TOKEN` | 無法 Reply／Push（401） |
| Messaging API → **Use webhook** | **開啟** | LINE 不送事件，Bot 完全不回應 |
| Messaging API → **Webhook URL** | 上表 Webhook URL，按 **Verify** 需成功 | 同上 |
| Messaging API → **Allow bot to join group chats** | **開啟** | 無法把 Bot 拉進群組 |
| Basic settings → **Your user ID** | 應看得到（`U` 開頭） | 看不到表示 Business ID 未綁 LINE 帳號 |

目前實測：Webhook endpoint 已設定且 `active = true`。

---

## 2. LINE Official Account Manager

位置：[manager.line.biz](https://manager.line.biz/) → 花園漫步 → 設定

| 設定 | 建議值 | 說明 |
|---|---|---|
| 回應模式 / Response mode | **Bot（聊天機器人）** | 設成「聊天」時，自動回應與人工聊天可能與 Bot 搶答 |
| 自動回應訊息 | **關閉** | 否則客人會同時收到罐頭訊息與 Bot 回覆 |
| 關鍵字回應 | **關閉**（測試期） | 同上 |
| 加入群組 | 已把官方帳號拉進專設群組 | 群組入口需要 |

目前實測：`chatMode = chat`。**建議改成 Bot**，並關閉自動回應／關鍵字回應，否則官方帳號「聊天」模式可能與本專案 Bot 搶答。漏改的後果：客人同時收到罐頭訊息與 Bot 回覆，或 Bot 看起來沒反應。

---

## 3. LINE Developers：LINE Login Channel

LIFF **掛在 LINE Login**，不是掛在 Messaging API。兩者必須在**同一個 Provider** 下。

| 設定 | 要求值 | 漏掉的後果 |
|---|---|---|
| **Use LINE Login in your web app** | **開啟** | LIFF 無法啟動登入 |
| **OpenID Connect** | 開啟 | 拿不到 ID Token，後端無法驗身份 |
| **Callback URL** | `https://liff.line.me`<br>`https://{{public_host}}` | 外部瀏覽器登入被擋 |
| **Linked LINE Official Account** | 連到「花園漫步」 | LIFF 的 Add friend option 非 Off 時，`liff.init` 可能回 `FORBIDDEN` |
| Channel ID | `LINE_LOGIN_CHANNEL_ID`（驗 ID Token 必填） | 後端無法驗身份，LIFF 送出 401 |
| Channel secret | `LINE_LOGIN_CHANNEL_SECRET`（可存；**目前程式不拿它驗 ID Token**） | 漏了不影響現有訂購；日後若接 Login 伺服器流程才需要 |
| **狀態 Developing / Published** | 自己測 → Developing 即可；開放給客人 → **Published** | Developing 時只有 Admin／Tester 且**已綁定 LINE 帳號**的人能登入，其他人 `FORBIDDEN`。Published 後**不能改回** |
| Roles | 自己為 Admin 或 Tester | 同上 |

### Business ID 綁定 LINE 帳號（Developing 測試必備）

Console 沒有「Link LINE account」按鈕，路徑是：右上頭像 → 帳號資訊 → **Go to Business ID Profile** → **LINE 帳號** 區塊 → 點連結圖示 → 用手機測試用的那個 LINE 登入。
驗證方式：Channel 的 Basic settings 出現 **Your user ID**。

---

## 4. LINE Developers：LIFF App

位置：Login Channel → **LIFF** 分頁

| 設定 | 要求值 | 漏掉的後果 |
|---|---|---|
| **Endpoint URL** | `https://{{public_host}}/liff/booking` | `INVALID_CONFIG`／頁面無法初始化 |
| **Size** | Tall 或 Full（目前 `full`） | 版面過小 |
| **Scope：openid** | 必要 | 拿不到 ID Token，送出訂單失敗 |
| **Scope：profile** | 建議勾 | 不勾則 `liff.getProfile()` 回 **`FORBIDDEN`**（無法自動帶入姓名；表單仍可用） |
| **Add friend option（botPrompt）** | 不需要引導加好友就設 **Off**；設 normal／aggressive 時必須有 Linked OA | `FORBIDDEN`（No bot could be resolved） |
| LIFF ID | 複製到 `NEXT_PUBLIC_LINE_LIFF_ID` | 頁面顯示未設定 LIFF ID |

目前實測：`scope = ["openid"]`（缺 profile）、`botPrompt = "normal"`、`view.type = full`、Endpoint 正確。

改名為「訂購」後 **不需要改任何 LINE Console 設定**：表單路徑刻意保留 `/liff/booking`，只有頁面文字與 API（`/api/orders`）改名。若日後想改成 `/liff/order`，必須同步改 LIFF Endpoint URL，否則會出現 `INVALID_CONFIG`。

開啟方式：使用者端網址為 `https://liff.line.me/2011165611-aEsHcumH`；請用**手機 LINE App** 從聊天室開啟，不要用 IDE 內嵌預覽（iframe 會被拒）。

---

## 5. Railway

| 項目 | 設定 |
|---|---|
| 專案 | Line Reservation |
| 服務 `web` | Source＝GitHub `chuwengming/mynaturelife`，分支 `master`；有公開網域 |
| 服務 `MySQL` | 官方 MySQL 模板（含 volume） |
| Healthcheck | `/api/health`（`railway.toml`） |
| 啟動指令 | `npx prisma migrate deploy && npm start`（`railway.toml`） |

### `web` 服務的環境變數

| 變數 | 來源 | 必要性 |
|---|---|---|
| `LINE_CHANNEL_SECRET` | Messaging API → Basic settings | 必要 |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API → 長期 token | 必要 |
| `LINE_LOGIN_CHANNEL_ID` | Login Channel → Basic settings | 必要（驗 ID Token） |
| `LINE_LOGIN_CHANNEL_SECRET` | Login Channel → Basic settings | 選配（現行程式驗 ID Token 只用 Channel ID） |
| `NEXT_PUBLIC_LINE_LIFF_ID` | Login Channel → LIFF 分頁 | 必要 |
| `DATABASE_URL` | 設為參照 `${{MySQL.MYSQL_URL}}` | 必要 |
| `ADMIN_LINE_USER_IDS` | 每位管理員在 1:1 傳「我的ID」取得，逗號串接，寫入 Railway `web` | 必要（新訂單／改單／取消通知，以及自然語言查庫）。漏掉該人：他問銷售數字不會查庫；也不會收到訂單 Push |
| `DEEPSEEK_API_KEY` | DeepSeek 平台 → API keys | 必要（Phase 3 AI 對話） |
| `AI_BASE_URL` | 留空即 `https://api.deepseek.com` | 選配（換供應商才填） |
| `AI_CHAT_MODEL` | 留空即 `deepseek-v4-flash` | 選配 |
| `AI_CLASSIFY_MODEL` | 留空即同 `AI_CHAT_MODEL` | 選配（想用更便宜的模型做分類才填） |
| `AI_WEB_SEARCH` | 留空即 `on`；設 `off` 則只讀 `docs/faq.md` | 選配 |

重點：**本機 `.env.local` 不會自動同步到 Railway**，兩邊都要填。`DATABASE_URL` 請用服務參照而非貼死字串，MySQL 換密碼時才不會斷。

後續階段會用到（先知道即可）：沒有。知識庫已改為 `docs/faq.md` + DeepSeek 搜尋。

---

## 5.1 AI 對話（Phase 3，DeepSeek）

| 設定 | 位置路徑 → 要求值 | 漏掉的後果 |
|---|---|---|
| API key | DeepSeek 平台 → API keys → 建立 → 貼到 Railway `web` 服務的 `DEEPSEEK_API_KEY` | 客人問產品或閒聊時只會收到「系統忙碌」固定文案；訂購與表單不受影響 |
| 帳戶餘額 | DeepSeek 平台 → 儲值頁面需有餘額 | API 回 402／餘額不足，AI 回覆退回固定文案 |
| 模型代號 | `deepseek-v4-flash`（程式預設，不必設定） | 填錯會 400 `model not found` |
| 產品資料 | 專案檔案 `docs/faq.md`，把 `TODO` 換成真實資料後 push | AI 一律回「這部分我先幫你確認，稍後請專人回覆你」，不會亂編價格 |
| 網路搜尋 | **不需要另一把金鑰**：走 DeepSeek `/responses` 的伺服器端 `web_search`，用同一把 `DEEPSEEK_API_KEY` | 若模型改成不支援 `/responses` 的供應商，搜尋會自動退回只讀 FAQ |

計費提醒：DeepSeek 自 2026-08-16 起分尖峰／離峰計價，V4 Flash 離峰約每百萬 token 輸入 $0.22、輸出 $0.66，尖峰（UTC 01:00–04:00、06:00–10:00，約台灣時間 09:00–12:00、14:00–18:00）加倍。一次客服回覆約 2000 輸入＋200 輸出 token，離峰約台幣 0.02 元。有動用網路搜尋時，搜到的內容會併入輸入 token 計費，單次成本大約多幾倍，但仍在角位數台幣分以內。

搜尋只在客人問到與本店規格無關的一般知識時才會觸發（例如豆腐乳怎麼入菜）；問價格、運費、成分一律走 `docs/faq.md`，不會拿網路資料充當本店規格。

金鑰請直接在 Railway 後台或 `railway variables --set` 設定，不要貼進聊天或寫進 repo。

---

## 5.2 新增管理員（查庫＋訂單通知）

本專案**沒有**後台帳號表。能不能管理，只看 Railway 變數 `ADMIN_LINE_USER_IDS` 是否包含對方的 Messaging API `userId`。LINE Developers 的 Admin／Tester 角色**不能**代替這一步（那只影響 Login Channel 還是 Developing 時誰能開 LIFF）。

對**每一位**新管理員，一次做完：

| 步驟 | 位置路徑 → 要求值 | 漏掉的後果 |
|---|---|---|
| 1. 加入官方帳號 | 對方用自己的 LINE 把「花園漫步」加為好友 | Bot 無法 1:1 回覆、也無法 Push 通知給他 |
| 2. 取得 userId | 對方在**一對一**聊天傳 `我的ID`（或 `/id`） | 沒有正確 ID 就無法列入變數。**不要把 ID 貼進這個對話**，由你在 Railway 填 |
| 3. 寫入變數 | Railway → 專案 Line Reservation → 服務 `web` → Variables → `ADMIN_LINE_USER_IDS` | 格式：`U` 開頭再加 32 位英數，多位用**英文逗號**串接，例如 `Uaaaa…,Ubbbb…`。可有空白，程式會 trim。格式不符的段會被忽略 |
| 4. 讓變數生效 | 儲存變數後等服務重部署（Railway 改變數通常會自動 redeploy） | 舊行程仍用舊名單，新管理員問統計仍當一般客人 |
| 5. （可選）本機 | 若你本機也要測，同步改 `.env.local` 的同一變數後重開 `npm run dev` | 本機與線上名單不一致 |
| 6. （僅當 Login 仍是 Developing） | LINE Developers → Login Channel → Roles 把對方加為 Tester，且對方 Business ID 已綁該 LINE | 他可以查庫，但可能仍打不開訂購表單（`FORBIDDEN`）。正式給客人用應 Published，此步就不需要 |

格式規則：不是 Channel ID、不是 LIFF ID、不是電話或 LINE 顯示名稱。群組裡的 userId 有時看得到，但仍以加好友後的 1:1「我的ID」為準。

新管理員生效後具備與現有管理員相同的能力：

- 1:1 用自然語言查訂購總量、客排名、訂單列表
- 收到新訂單、客人取消、客人更改的 Push
- 自己也可以當客人訂購／取消／改自己的單（查庫與改自己的單互不衝突）

驗證：新管理員在 1:1 傳「本月訂購總量，原味辣味分開」→ 應收到統計。用**尚未列入名單**的帳號傳同一句 → 應走一般客服，不得出現銷售數字。

移除管理員：從 `ADMIN_LINE_USER_IDS` 刪掉該段 userId 並重新部署即可。

---

## 6. 驗證步驟（每次改設定後跑一次）

1. `https://{{public_host}}/api/health` → 金鑰旗標為 `true`；`databaseOk` 為軟性探活（false 時服務仍算健康，但改單／訂購會失敗）。
2. LINE Console 按 **Verify** → 成功。
3. 1:1 傳任意文字 → Bot 有回覆。
4. 1:1 傳「我的ID」 → 回傳 `U…`。
5. 傳「訂購」 → 出現按鈕 → 開啟訂購表單 → 填數量後送出 → 聊天室收到「訂單已成立」。
6. 傳「豆腐乳怎麼保存？」 → 依 `docs/faq.md` 回答。
7. 傳「取消訂購」→ 列出本人訂單 → 確定後狀態變為已取消。
8. 傳「更改訂購」→ 確認訂單 → 說明要改的內容 → 確定後資料庫更新。
9. 管理員在 **1:1** 傳「請提供上週原味與辣味訂購總量」→ 得到統計；一般使用者傳同樣的話不會查庫。
10. 連續閒聊 6 句 → 禮貌收尾。
11. 需要時查 Railway log：`railway logs --service web --deployment --lines 100`。

---

## 7. 錯誤代碼對照

| 現象 | 真正原因 | 處理 |
|---|---|---|
| Verify 失敗 | Webhook URL 錯、服務未啟動、Secret 未設 | 查 `/api/health` 與 Railway 部署狀態 |
| webhook 回 401 | `LINE_CHANNEL_SECRET` 不符 | 重新複製 Secret 到 Railway |
| LIFF `FORBIDDEN`（init 階段） | Login Channel 為 Developing 而帳號未綁定／非 Admin-Tester；或 botPrompt 非 Off 但沒連 OA；或在 iframe 內開啟 | 綁定 Business ID↔LINE、設 Add friend option 為 Off、用手機 LINE 開啟 |
| LIFF `FORBIDDEN`（profile 階段） | LIFF Scope 缺 `profile` | 加勾 profile（不加也能訂購，只是不自動帶名字） |
| `INVALID_LIFF_ID` | `NEXT_PUBLIC_LINE_LIFF_ID` 錯或未設 | 核對 LIFF 分頁的 ID |
| `INVALID_CONFIG` | 目前網址與 Endpoint URL 不一致 | 修正 LIFF Endpoint |
| 送出訂單時「取不到登入憑證」 | Scope 缺 `openid` | 加勾 openid |
| 送出後 503 | `DATABASE_URL` 未設或 MySQL 未啟動 | 檢查 Railway 變數參照與 MySQL 服務 |
| 聊天一律回「系統忙碌了一下」 | `DEEPSEEK_API_KEY` 未設、餘額不足或模型代號錯 | 查 `/api/health` 的 `hasAiKey`，再看 Railway log 的 `AI HTTP` 錯誤碼 |
| AI 回 200 但內容空白 | DeepSeek V4 思考模式吃掉 `max_tokens` | 請求須帶 `thinking: {"type":"disabled"}`（程式已固定帶上） |
| AI 回 400 `Prompt must contain the word 'json'` | 用了 json 輸出模式但提示詞沒有 json 字樣 | 提示詞加上「json」 |
| AI 回答含「TODO」或說要請專人回覆 | `docs/faq.md` 該項還是 TODO | 補上真實資料並 push |
| 管理員在群組問銷售數字沒回應報表 | 查庫只允許 1:1 | 請管理員開一對一聊天 |

---

## 8. 安全注意

- `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`、`LINE_LOGIN_CHANNEL_SECRET`、`DATABASE_URL` 僅存在於 Railway Variables 與本機 `.env.local`（已 gitignore）。
- 只有 `NEXT_PUBLIC_LINE_LIFF_ID` 可進前端。
- `railway variable list` 會印出明文，輸出不要外流或貼到公開處。
