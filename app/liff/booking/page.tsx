"use client";

import { useEffect, useState, useCallback } from "react";
import BookingForm from "./booking-form";

interface LiffInitOptions {
  liffId: string;
  withLoginOnExternalBrowser?: boolean;
}

interface LiffProfile {
  displayName?: string;
}

interface LiffLike {
  init: (opts: LiffInitOptions) => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  getIDToken: () => string | null;
  getProfile: () => Promise<LiffProfile>;
  closeWindow?: () => void;
}

declare global {
  interface Window {
    liff?: LiffLike;
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
      if (!liff) {
        setState({ status: "error", message: "LIFF SDK 尚未就緒，請重新開啟表單" });
        return;
      }
      await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) {
        setState({ status: "error", message: "登入失敗：無法取得 ID Token，請重新開啟表單" });
        return;
      }
      // getProfile 失敗不得擋送出（invariants §5）：獨立 try，失敗僅失去自動帶入姓名
      let profileName: string | undefined;
      try {
        const profile = await liff.getProfile();
        profileName = profile?.displayName;
      } catch (err: unknown) {
        console.warn("getProfile failed (non-blocking):", err instanceof Error ? err.message : err);
      }
      setState({ status: "ready", idToken, profileName });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ status: "error", message: `LIFF 初始化失敗：${msg}` });
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
