"use client";

import { useMemo, useState } from "react";

interface BookingFormProps {
  idToken: string;
  profileName?: string;
}

const SLOTS = [
  { value: "09:00", label: "上午 9:00" },
  { value: "10:00", label: "上午 10:00" },
  { value: "11:00", label: "上午 11:00" },
  { value: "12:00", label: "上午 12:00" },
  { value: "13:00", label: "下午 13:00" },
  { value: "14:00", label: "下午 14:00" },
  { value: "15:00", label: "下午 15:00" },
  { value: "16:00", label: "下午 16:00" },
];

const ITEMS = [
  { value: "haircut", label: "剪髮" },
  { value: "perm", label: "燙髮" },
  { value: "color", label: "染髮" },
  { value: "shampoo", label: "洗髮" },
];

export default function BookingForm({ idToken, profileName }: BookingFormProps) {
  const [form, setForm] = useState({
    name: profileName ?? "",
    phone: "",
    bookingDate: "",
    bookingSlot: "",
    bookingItem: "",
    people: "1",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const minDate = useMemo(() => {
    const now = new Date();
    const taipei = new Date(now.getTime() + 8 * 3600 * 1000);
    const y = taipei.getUTCFullYear();
    const m = String(taipei.getUTCMonth() + 1).padStart(2, "0");
    const d = String(taipei.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  function dateDisabled(dateStr: string): boolean {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const wd = date.getUTCDay();
    return wd === 0 || wd === 1 || wd === 6;
  }

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // 清除任何殘留的 custom validity，避免瀏覽器擋住 submit
    const formEl = e.currentTarget;
    formEl.querySelectorAll("input, select, textarea").forEach((el) => {
      if ("setCustomValidity" in el) (el as HTMLInputElement).setCustomValidity("");
    });

    // 日期檢查：非開放日 → 明確錯誤
    if (form.bookingDate && dateDisabled(form.bookingDate)) {
      setResult({ ok: false, message: "僅週二至週五可預約，請重新選擇日期。" });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, people: Number(form.people), idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setResult({ ok: true, message: "✅ 預約已成立！請至 LINE 聊天室查看明細。" });
        setForm((f) => ({ ...f, bookingSlot: "", bookingItem: "", notes: "" }));
      } else {
        setResult({ ok: false, message: data.error ?? `送出失敗（HTTP ${res.status}）` });
      }
    } catch (err) {
      setResult({ ok: false, message: `網路錯誤：${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <h1 style={{ color: "#1DB446", fontSize: "1.5rem" }}>花園漫步 — 預約表單</h1>
      <p style={{ fontSize: ".9rem", color: "#666" }}>僅週二～週五營業。送出即成立。</p>

      {result && (
        <div style={{ margin: "1rem 0", padding: ".8rem", borderRadius: 8, background: result.ok ? "#e6f7ec" : "#fdecea", color: result.ok ? "#1d7a3c" : "#c0392b", whiteSpace: "pre-wrap" }}>
          {result.message}
        </div>
      )}

      <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1rem" }} noValidate>
        <Field label="姓名 *">
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} />
        </Field>
        <Field label="電話 *">
          <input required type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inputStyle} placeholder="09xx-xxx-xxx" />
        </Field>
        <Field label="預約日期 *（週二～週五）">
          <input
            required type="date" value={form.bookingDate} min={minDate}
            onChange={(e) => set("bookingDate", e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="時段 *">
          <select required value={form.bookingSlot} onChange={(e) => set("bookingSlot", e.target.value)} style={inputStyle}>
            <option value="">請選擇時段</option>
            {SLOTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="服務項目 *">
          <select required value={form.bookingItem} onChange={(e) => set("bookingItem", e.target.value)} style={inputStyle}>
            <option value="">請選擇服務</option>
            {ITEMS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: ".35rem", fontSize: ".9rem", fontWeight: 500 }}>
      {label}
      {children}
    </label>
  );
}
