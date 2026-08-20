// lib/line/client.ts — LINE Messaging API Client（僅 server）
import { Client, middleware } from "@line/bot-sdk";
import { channelAccessToken, channelSecret } from "./env";

let _client: Client | null = null;

export function getLineClient(): Client {
  if (!_client) {
    _client = new Client({
      channelAccessToken: channelAccessToken(),
      channelSecret: channelSecret(),
    });
  }
  return _client;
}

export function getMiddleware() {
  return middleware({
    channelSecret: channelSecret(),
  });
}
