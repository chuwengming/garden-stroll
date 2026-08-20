# Phase 0：你需要在 LINE Developers 完成的事

> 來自 `line-bot-custom-service` skill。請把文中網域／品牌改成**本專案** Intake 參數；參考案網域僅供格式對照。

此階段無法由程式代勞。完成後把 Secret／Token 填進本機 `.env.local`（以及之後的 Railway Variables）。**不要貼到聊天或 commit。**

Messaging API 的 Channel secret、Channel access token 若已填好，下面從 **LINE Login／LIFF** 與 **管理員 userId** 繼續即可。

## Messaging API（若尚未做）

1. 開啟 [LINE Developers Console](https://developers.line.biz/console/)。
2. 選或建立 Provider，建立（或開啟既有）Messaging API Channel，名稱：`{{oa_display_name}}`。
3. **Basic settings**：複製 **Channel secret** → `LINE_CHANNEL_SECRET`
4. **Messaging API**
   - 發行 **Channel access token（長期）** → `LINE_CHANNEL_ACCESS_TOKEN`
   - 開啟 **Allow bot to join group chats**
   - Webhook URL 填：`https://{{public_host}}/api/line/webhook`（需等 Railway 公開 HTTPS）
5. [LINE Official Account Manager](https://manager.line.biz/)：
   - **回應功能 → 聊天：關閉**（改由 Webhook Bot 處理）
   - Webhook：開啟
   - 加入好友歡迎訊息：建議關閉（Bot 會發）
   - 自動回應／關鍵字回應：關閉
   - 加好友並視需要拉進專設群組。

## LINE Login（LIFF 的前置，現在就可以做）

LIFF 掛在 **LINE Login**，不是掛在 Messaging API 的 Secret／Token 上。兩者要在**同一個 Provider** 底下。

1. 同一 Provider → **Create a new channel** → 選 **LINE Login**（名稱可用 `{{oa_display_name}} Login`）。
2. 應用類型選 **Web app**。
3. 打開該 Login Channel 的 **LINE Login** 分頁：
   - 狀態可先維持 Developing（測試用）。Developing 時**只有 Admin／Tester 且 LINE 帳號已綁定該開發者**才能登入；一般好友會得到 FORBIDDEN。要給所有使用者使用，需把 LINE Login Channel 改為 **Published**（發布後不能改回 Developing）。
   - 開啟 **OpenID Connect**（之後驗證 LIFF ID Token 需要 `openid`）。
   - **Callback URL** 請加入（缺一不可）：
     - `https://liff.line.me`
     - `https://{{public_host}}`
   - 權限／Scope：至少 **profile**、**openid**。
4. 若 Console 提供「連結官方帳號」，請連到 Messaging 官方帳號。
5. Login Channel 另有自己的 **Channel ID** 與 **Channel secret**（和 Messaging API 那組不同）：
   - `LINE_LOGIN_CHANNEL_ID`
   - `LINE_LOGIN_CHANNEL_SECRET`  
   不要加 `NEXT_PUBLIC_` 前綴。（現行程式驗 ID Token 主要以 Channel ID；Secret 可存。）

若 Console 提示「要先完成 LINE Login 才能加入 LIFF」：依畫面完成即可，LIFF 分頁才會解鎖。

## 如何取得 `NEXT_PUBLIC_LINE_LIFF_ID`

LIFF Endpoint 必須是 **https**，路徑以 `docs/form-schema.yaml` 的 `liff_path` 為準（預設）：

```
https://{{public_host}}/liff/booking
```

**不能填** `http://localhost:3000/…`。

Railway 網域未定前可先填佔位 HTTPS；上線後改 Endpoint。**LIFF ID 不會因改 Endpoint 而變。**

1. **LINE Login Channel** → **LIFF** → **Add**。
2. Size：Tall 或 Full；Scope：`openid` 必要、`profile` 建議；Add friend option 不需引導則設 **Off**。
3. 複製 **LIFF ID** → `NEXT_PUBLIC_LINE_LIFF_ID`。

## 如何取得 `ADMIN_LINE_USER_IDS`

管理員本人的 Messaging API `userId`（`U` + 32 英數），不是 Channel ID。

1. 加官方帳號好友後，**一對一**傳 `我的ID`（Webhook 通了才有反應）。
2. 把回傳的 ID 寫入 Railway `ADMIN_LINE_USER_IDS`（多位用英文逗號）。**不要貼進 Agent 對話。**

## 等 Railway 網址出來後再做

- Messaging Webhook URL + **Verify**
- LIFF Endpoint 與 Login Callback 改為真正 `https://{{public_host}}…`

## 本機

複製 `.env.example` → `.env.local`。至少先填 Messaging Secret／Token。
