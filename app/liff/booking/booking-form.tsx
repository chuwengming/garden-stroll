"use client";

import { useMemo, useRef, useState, useEffect } from "react";

interface BookingFormProps {
  idToken: string;
  profileName?: string;
}

const ITEMS = [
  { value: "shampoo", label: "洗髮" },
  { value: "conditioning", label: "護髮" },
  { value: "haircut", label: "剪髮" },
  { value: "color", label: "染髮" },
  { value: "perm", label: "燙髮" },
];

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function closeLiffWindow() {
  const liff = window.liff;
  if (liff && typeof liff.closeWindow === "function") {
    try { liff.closeWindow(); } catch { /* ignore */ }
  }
}

interface DayInfo {
  date: string;
  status: "open" | "closed" | "partial";
  reason?: string;
}

interface SlotInfo { start: string; end: string; }

export default function BookingForm({ idToken, profileName }: BookingFormProps) {
  const [form, setForm] = useState({
    name: profileName ?? "",
    phone: "",
    bookingDate: "",
    startTime: "",
    items: [] as string[],
    people: "1",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitted, setSubmitted] = useState<{ bookingId: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 行事曆狀態
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
    return { y: taipei.getUTCFullYear(), m: taipei.getUTCMonth() + 1 };
  });
  const [days, setDays] = useState<DayInfo[]>([]);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);

  const selectedItemsKey = form.items.slice().sort().join(",");

  // 載入行事曆（月 + 選定項目）
  useEffect(() => {
    const monthStr = viewMonth.y + "-" + String(viewMonth.m).padStart(2, "0");
    const itemsStr = selectedItemsKey || "haircut";
    setLoadingDays(true);
    fetch("/api/calendar?month=" + monthStr + "&items=" + encodeURIComponent(itemsStr))
      .then((res) => res.json())
      .then((data) => { setDays(data.days ?? []); })
      .catch(() => setDays([]))
      .finally(() => setLoadingDays(false));
  }, [viewMonth.y, viewMonth.m, selectedItemsKey]);

  // 選日期 → 載入時段
  useEffect(() => {
    if (!form.bookingDate) { setSlots([]); return; }
    const itemsStr = selectedItemsKey || "haircut";
    fetch("/api/availability?date=" + form.bookingDate + "&items=" + encodeURIComponent(itemsStr))
      .then((res) => res.json())
      .then((data) => { setSlots(data.availableSlots ?? []); })
      .catch(() => setSlots([]));
  }, [form.bookingDate, selectedItemsKey]);

  const todayStr = useMemo(() => {
    const now = new Date();
    const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
    const y = taipei.getUTCFullYear();
    const m = String(taipei.getUTCMonth() + 1).padStart(2, "0");
    const d = String(taipei.getUTCDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }, []);

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  function toggleItem(value: string) {
    setForm((f) => {
      const has = f.items.includes(value);
      const items = has ? f.items.filter((i) => i !== value) : [...f.items, value];
      return { ...f, items, startTime: "" };
    });
  }

  // 月曆網格：找出該月第一天是星期幾
  const grid = useMemo(() => {
    const first = new Date(Date.UTC(viewMonth.y, viewMonth.m - 1, 1));
    const startWday = first.getUTCDay(); // 0=Sun
    const dayMap = new Map(days.map((d) => [d.date, d]));
    const cells: (DayInfo | null)[] = [];
    for (let i = 0; i < startWday; i++) cells.push(null);
    const count = new Date(Date.UTC(viewMonth.y, viewMonth.m, 0)).getUTCDate();
    for (let d = 1; d <= count; d++) {
      const dateStr = viewMonth.y + "-" + String(viewMonth.m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      cells.push(dayMap.get(dateStr) ?? { date: dateStr, status: "closed", reason: "weekend" });
    }
    return cells;
  }, [days, viewMonth]);

  function prevMonth() {
    setViewMonth((vm) => (vm.m === 1 ? { y: vm.y - 1, m: 12 } : { y: vm.y, m: vm.m - 1 }));
  }
  function nextMonth() {
    setViewMonth((vm) => (vm.m === 12 ? { y: vm.y + 1, m: 1 } : { y: vm.y, m: vm.m + 1 }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.bookingDate || !form.startTime) {
      setResult({ ok: false, message: "請選擇日期與時段" });
      return;
    }
    if (form.items.length === 0) {
      setResult({ ok: false, message: "請至少選擇一個服務項目" });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          people: Number(form.people),
          items: form.items,
          idToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSubmitted({ bookingId: data?.booking?.id ?? 0 });
        closeTimer.current = setTimeout(() => closeLiffWindow(), 3500);
      } else {
        let msg = data.error ?? ("送出失敗（HTTP " + res.status + "）");
        if (Array.isArray(data.alternates) && data.alternates.length > 0) {
          msg += "\n可用時段：" + data.alternates.join("、");
        }
        setResult({ ok: false, message: msg });
      }
    } catch (err) {
      setResult({ ok: false, message: "網路錯誤：" + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main style={{ maxWidth: 520, margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
        <h1 style={{ color: "#1DB446", fontSize: "1.4rem" }}>預約已成立！</h1>
        <p style={{ margin: "1rem 0", color: "#555" }}>預約明細已傳送至 LINE 對話，請返回聊天室查看。</p>
        <button onClick={() => closeLiffWindow()} style={{ padding: ".9rem 2rem", background: "#1DB446", color: "#fff", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 600 }}>返回 LINE 對話</button>
        <p style={{ marginTop: "1rem", fontSize: ".85rem", color: "#999" }}>視窗將自動關閉…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <h1 style={{ color: "#1DB446", fontSize: "1.5rem" }}>花園漫步 — 預約表單</h1>
      <p style={{ fontSize: ".9rem", color: "#666" }}>僅週二～週五營業（09:00～17:00）。送出即成立。</p>

      {result && (
        <div style={{ margin: "1rem 0", padding: ".8rem", borderRadius: 8, background: result.ok ? "#e6f7ec" : "#fdecea", color: result.ok ? "#1d7a3c" : "#c0392b", whiteSpace: "pre-wrap" }}>{result.message}</div>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1rem" }} noValidate>
        <Field label="姓名 *">
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="電話 *">
          <input required type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inputStyle} placeholder="09xx-xxx-xxx" />
        </Field>

        <Field label="服務項目 *（可複選）">
          <div style={{ display: "grid", gap: ".5rem" }}>
            {ITEMS.map((it) => (
              <label key={it.value} style={{ display: "flex", alignItems: "center", gap: ".5rem", padding: ".5rem", border: "1px solid #ddd", borderRadius: 8, background: form.items.includes(it.value) ? "#e6f7ec" : "#fff" }}>
                <input type="checkbox" checked={form.items.includes(it.value)} onChange={() => toggleItem(it.value)} />
                <span>{it.label}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="預約日期 *">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".5rem" }}>
            <button type="button" onClick={prevMonth} style={navBtn}>◀</button>
            <strong>{viewMonth.y} 年 {viewMonth.m} 月</strong>
            <button type="button" onClick={nextMonth} style={navBtn}>▶</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
            {WEEKDAY_LABELS.map((w) => (<div key={w} style={{ fontSize: ".75rem", color: "#888", padding: 2 }}>{w}</div>))}
            {grid.map((cell, i) =>
              cell === null ? <div key={"e" + i} /> :
              <button
                key={cell.date}
                type="button"
                disabled={cell.status === "closed" || cell.date < todayStr}
                onClick={() => { set("bookingDate", cell.date); set("startTime", ""); }}
                style={{
                  padding: "8px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: ".85rem",
                  background: cell.status === "open" ? "#ffffff" : cell.status === "partial" ? "#c8e6c9" : "#e0e0e0",
                  color: cell.status === "closed" || cell.date < todayStr ? "#bbb" : "#333",
                  cursor: cell.status === "closed" || cell.date < todayStr ? "not-allowed" : "pointer",
                  outline: form.bookingDate === cell.date ? "2px solid #1DB446" : "none",
                }}
              >
                {Number(cell.date.slice(8))}
              </button>
            )}
          </div>
          {loadingDays && <p style={{ fontSize: ".75rem", color: "#999", marginTop: 4 }}>載入行事曆…</p>}
        </Field>

        {form.bookingDate && (
          <Field label="開始時段 *">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
              {slots.length === 0 ? (
                <p style={{ fontSize: ".8rem", color: "#c0392b" }}>此日已無可預約時段</p>
              ) : slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => set("startTime", s.start)}
                  style={{
                    padding: ".5rem 0",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    fontSize: ".8rem",
                    background: form.startTime === s.start ? "#1DB446" : "#fff",
                    color: form.startTime === s.start ? "#fff" : "#333",
                    cursor: "pointer",
                  }}
                >
                  {s.start}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="人數 *（1～10）">
          <input required type="number" min={1} max={10} value={form.people} onChange={(e) => set("people", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="備註">
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} style={{ ...inputStyle, minHeight: 70 }} />
        </Field>
        <button type="submit" disabled={submitting} style={{ padding: ".9rem", background: "#1DB446", color: "#fff", border: "none", borderRadius: 8, fontSize: "1rem", fontWeight: 600 }}>
          {submitting ? "送出中…" : "確認預約"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: ".7rem", fontSize: "1rem",
  border: "1px solid #ccc", borderRadius: 8, background: "#fff",
};

const navBtn: React.CSSProperties = {
  padding: ".4rem .8rem", border: "1px solid #ccc", borderRadius: 6, background: "#fff", cursor: "pointer",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: ".35rem", fontSize: ".9rem", fontWeight: 500 }}>
      {label}
      {children}
    </label>
  );
}
