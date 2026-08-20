// lib/line/verify-id-token.ts — 驗證 LINE Login ID Token
import jwt from "jsonwebtoken";
import { loginChannelId } from "./env";

export interface LineIdTokenPayload {
  iss: string;
  sub: string;          // LINE userId
  aud: string;          // Channel ID
  exp: number;
  iat: number;
  nonce?: string;
  name?: string;
  picture?: string;
}

export async function verifyIdToken(
  idToken: string,
  nonce?: string
): Promise<LineIdTokenPayload> {
  const channelId = loginChannelId();
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET ?? "";

  if (!channelSecret) {
    throw new Error("Missing LINE_LOGIN_CHANNEL_SECRET for ID token verification");
  }

  const decoded = jwt.verify(idToken, channelSecret, {
    algorithms: ["HS256"],
    issuer: "https://access.line.me",
    audience: channelId,
  }) as LineIdTokenPayload;

  if (nonce && decoded.nonce !== nonce) {
    throw new Error("ID token nonce mismatch");
  }

  return decoded;
}
