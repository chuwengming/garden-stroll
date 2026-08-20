// lib/line/env.ts — 環境變數讀取（僅 server）
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name];
}

export function channelSecret(): string {
  return requireEnv("LINE_CHANNEL_SECRET");
}

export function channelAccessToken(): string {
  return requireEnv("LINE_CHANNEL_ACCESS_TOKEN");
}

export function loginChannelId(): string {
  return requireEnv("LINE_LOGIN_CHANNEL_ID");
}

export function liffId(): string {
  return optionalEnv("NEXT_PUBLIC_LINE_LIFF_ID") ?? "";
}

export function adminLineUserIds(): string[] {
  return (optionalEnv("ADMIN_LINE_USER_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminLineUser(userId: string | undefined): boolean {
  if (!userId) return false;
  return adminLineUserIds().includes(userId);
}

export function databaseUrl(): string | undefined {
  return optionalEnv("DATABASE_URL");
}

export function hasLineCredentials(): { hasChannelSecret: boolean; hasChannelAccessToken: boolean } {
  return {
    hasChannelSecret: Boolean(optionalEnv("LINE_CHANNEL_SECRET")),
    hasChannelAccessToken: Boolean(optionalEnv("LINE_CHANNEL_ACCESS_TOKEN")),
  };
}
