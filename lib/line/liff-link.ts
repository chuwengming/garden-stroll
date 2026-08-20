// lib/line/liff-link.ts — LIFF 網址
export function liffAppUrl(): string {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";
  if (!liffId) return "";
  return `https://liff.line.me/${liffId}`;
}

export function bookingButtonUri(): string {
  return liffAppUrl();
}
