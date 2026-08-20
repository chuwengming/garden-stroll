import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "花園漫步 — 美髮預約",
  description: "花園漫步 LINE 美髮預約系統",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
