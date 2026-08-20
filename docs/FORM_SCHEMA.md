# Form schema notes (line-bot-custom-service)

Authoritative field list for a new project lives in **`docs/form-schema.yaml`**
(copied from `templates/form-schema.example.yaml` during bootstrap).

## Rules

1. Confirm schema with the user in Intake before Phase 2 code.
2. `terminology: order` → 訂購／訂單／`orders`；`booking` → 預約／`bookings`.
3. Keep `liff_path: /liff/booking` unless the user accepts reconfiguring LINE LIFF Endpoint.
4. Any field change must update in the **same turn**: Prisma, validate module, LIFF form, `docs/faq.md`, `docs/invariants.md`.
5. `create_rules` are cross-field rules beyond per-field `required`.

## Booking vs order

See commented block at the bottom of `form-schema.example.yaml`.
