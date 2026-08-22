# Form schema notes (line-bot-custom-service)

Authoritative field list for a new project lives in **`docs/form-schema.yaml`**
(copied from `templates/form-schema.example.yaml` during bootstrap).

## Rules

1. Confirm schema with the user in Intake before Phase 2 code.
2. `terminology: order` → 訂購／訂單／`orders`；`booking` → 預約／`bookings`.
3. Keep `liff_path: /liff/booking` unless the user accepts reconfiguring LINE LIFF Endpoint.
4. Any field change must update in the **same turn**: Prisma, validate module, LIFF form, `docs/faq.md`, `docs/invariants.md`.
5. `create_rules` are cross-field rules beyond per-field `required`.
6. **Schedule 進階模組**（可選）：若啟用 `schedule:` 區塊，須同步 `lib/booking/durations.ts`、`schedule.ts`、calendar/availability API、FAQ 價格與工時；見 skill `lessons-learned.md` L14～L18。

## Booking vs order

See commented block at the bottom of `form-schema.example.yaml`.

## Simple slot vs Schedule v2

| 模式 | form-schema 特徵 | 適用 |
|---|---|---|
| **Simple**（Phase 2 預設） | 單一 `booking_item` + 固定 `booking_slot` select | 訂購、簡單預約、無並行容量 |
| **Schedule v2**（Phase 5+ 選配） | `items` 複選 + `start_time` 動態 + `schedule:` 區塊 | 美髮／診所等需工時與容量規則 |

新案預設 Simple；使用者明確要求排程引擎時才升級 Schedule v2，並同輪更新契約與 FAQ。
