"use client";

import { useEffect, useState, useCallback } from "react";
import BookingForm from "./booking-form";

declare global {
  interface Window {
    liff: any;
  }
}

type LiffState =
  | { status: "loading" }
  | { status: "ready"; idToken: string; profileName?: string }
  | { status: "error"; message: string };

const LIFF_ID = process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "";

export default function BookingPage() {
  const [state, setState] = useState<LiffState>({ status: "loading" });

  const initLiff = useCallback(async () => {
    if (!LIFF_ID) {
      setState({ status: "error", message: "尚未設定 LIFF ID" });
      return;
    }
    try {
      const liff = window.liff;
      await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const profile = await liff.getProfile();
      setState({
        status: "ready",
        idToken: liff.getIDToken(),
        profileName: profile?.displayName,
      });
    } catch (err: any) {
      setState({ status: "error", message: `LIFF 初始化失敗：${err?.message ?? String(err)}` });
    }
  }, []);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2.1/sdk.js";
    script.async = true;
    script.onload = () => initLiff();
    script.onerror = () => setState({ status: "error", message: "無法載入 LIFF SDK" });
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [initLiff]);

  if (state.status === "loading") {
    return (
      <main style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ color: "#1DB446" }}>花園漫步</h1>
        <p>載入 LINE 登入中…</p>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main style={{ padding: "3rem 1.5rem" }}>
        <h1 style={{ color: "#1DB446" }}>花園漫步</h1>
        <p style={{ color: "#c0392b" }}>{state.message}</p>
        <p>請從 LINE 聊天室的預約按鈕開啟此頁面。</p>
      </main>
    );
  }

  return <BookingForm idToken={state.idToken} profileName={state.profileName} />;
}
