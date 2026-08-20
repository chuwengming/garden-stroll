// lib/line/verify-id-token.ts — 驗證 LINE Login ID Token（ES256 via JWKS）
import { createRemoteJWKSet, jwtVerify } from "jose";
import { loginChannelId } from "./env";

const JWKS_URL = "https://api.line.me/oauth2/v2.1/certs";
const LINE_ISSUER = "https://access.line.me";

// 遠端 JWKS（jose 內部會 cache；失敗會重新抓取）
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

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

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: LINE_ISSUER,
    audience: channelId,
  });

  if (nonce && payload.nonce !== nonce) {
    throw new Error("ID token nonce mismatch");
  }

  return payload as unknown as LineIdTokenPayload;
}
