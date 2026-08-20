// lib/line/messages.ts — 訊息與回覆建構
import type { TextMessage, FlexMessage } from "@line/bot-sdk";

export function textMessage(text: string): TextMessage {
  return { type: "text", text };
}

export function bookingButtonFlex(): FlexMessage {
  return {
    type: "flex",
    altText: "花園漫步預約表單",
    contents: {
      type: "bubble",
      hero: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "花園漫步",
            weight: "bold",
            size: "xl",
            color: "#1DB446",
          },
          {
            type: "text",
            text: "美髮預約服務（週二～週五）",
            size: "sm",
            color: "#555555",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            action: {
              type: "uri",
              label: "開啟預約表單",
              uri: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/liff/booking`,
            },
          },
        ],
      },
    },
  };
}

export function welcomeMessages(): (TextMessage | FlexMessage)[] {
  return [
    textMessage("歡迎來到花園漫步！我是預約小幫手。"),
    textMessage("傳「預約」即可開啟預約表單；傳「我的ID」可查詢您的 LINE ID。"),
  ];
}
