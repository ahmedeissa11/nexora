# NEXORA — Phase 8 Stripe payment foundation (prompt 4/30)

**STRIPE INTEGRATION IMPLEMENTED**  
**LIVE STRIPE VERIFICATION = NOT EXECUTED**  
**LIVE STRIPE VERIFICATION BLOCKED BY MISSING EXTERNAL CREDENTIALS**

Do not treat this as live-tested against Stripe’s network. No test-mode secret key, publishable key, or webhook signing secret was present in the authorized environment. None were invented. Deterministic tests used an in-process Stripe mock plus the official `stripe.webhooks.constructEvent` / `generateTestHeaderString` APIs.

---

## 1. Stripe architecture

```
Browser  →  Express POST /api/orders
         →  pending_payment order + InventoryReservation(active)
         →  cart cleared, Product.stock unchanged
Browser  →  Express POST /api/orders/:id/checkout-session
         →  ownership + reservation + expiry checks
         →  line items from server-side OrderItem snapshots (Decimal → integer cents)
         →  Stripe Checkout Session (hosted)
         →  { url } only
Customer →  Stripe hosted checkout
Stripe   →  POST /api/webhooks/stripe  (raw body + stripe-signature)
Express  →  verify signature
         →  StripeEvent unique insert (idempotency)
         →  amount/currency/order-state checks
         →  confirmPaidOrder
         →  consume reservations, decrement Product.stock once, status=paid
Browser  →  GET /api/orders/:id  (real status; URL flags are not proof)
```

The success URL is never treated as payment. There is no public mark-paid route. `POST /api/orders/:id/pay` remains **404**.

Hosted Checkout only — no Stripe.js, no publishable key in the SPA.

---

## 2. Endpoints added/changed

| Method | Path | Role |
|---|---|---|
| POST | `/api/orders` | Unchanged contract (`201` pending_payment). Guest orders also set HttpOnly `nexora_oid`. |
| POST | `/api/orders/:id/checkout-session` | **New.** Owner/guest-token only. Server-side amounts. Returns `{ url, sessionId, orderId, expiresAt }`. |
| GET | `/api/orders/:id` | Owner session **or** matching `nexora_oid` for guest orders. Guests still cannot read authenticated orders. |
| POST | `/api/webhooks/stripe` | **New.** Raw JSON body, signature required. Mounted *before* `express.json`. |
| POST | `/api/orders/:id/pay` | Still **404** (not added). |

When Stripe is not configured, checkout-session and the webhook return **503** `{ error: "Payments are unavailable" }`. Creating a pending order still works.

---

## 3. Database changes

Additive migration `20260907140000_stripe_payments` — **deployed, never reset**.

On `Order`:

- `currency` default `usd`
- `guestAccessHash`
- `stripeCheckoutSessionId` (unique, nullable)
- `stripePaymentIntentId`

New table `StripeEvent`:

- `id` = Stripe event id (primary key / idempotency)
- `type`, `orderId`, `createdAt`

Existing products, users, orders, items, and reservations were not dropped or truncated. A synthetic `placed` row was inserted only to prove legacy status is not auto-converted; it remains `placed`.

---

## 4. Payment lifecycle

1. Checkout form → `POST /api/orders` → `pending_payment` + 15-minute reservation.
2. SPA calls `POST /api/orders/:id/checkout-session`. If `url` is `https://checkout.stripe.com/…`, the browser redirects. If payments are unavailable (503), the overlay shows **pending**, not paid.
3. After Stripe return (`/?checkout_return=1&order=NX-…&session_id=…` or cancel), JS **strips the query** and `GET /api/orders/:id`. Display follows **server status** (`paid` / `pending_payment` / expired|cancelled). `?paid=true` / `?success=true` are ignored.

---

## 5. Webhook lifecycle

- Raw body only (`express.raw`).
- Missing or invalid `stripe-signature` → **400** `"Invalid signature"`.
- Handled: `checkout.session.completed`, `checkout.session.async_payment_succeeded` (fulfill if `payment_status=paid`); `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed` (record, do not pay).
- Fulfillment requires: matching `metadata.orderId` / `client_reference_id`, `amount_total` === snapshot cents, `currency` === order currency (`usd`), order `pending_payment`, reservations still **active** and unexpired.
- Expired / `placed` / amount mismatch / currency mismatch → event stored, order **not** paid, HTTP 200 so Stripe does not retry a known decline.
- Unexpected errors delete the `StripeEvent` row so a later retry can apply.

---

## 6. Idempotency strategy

1. Unique `StripeEvent.id` — duplicate delivery of the same event returns `{ received: true, duplicate: true }` with no inventory work.
2. `confirmPaidOrder` returns `alreadyPaid: true` if status is already `paid` (second distinct event cannot decrement again).
3. Stock decrement uses `updateMany` with `stock: { gte: qty }` inside the same transaction as reservation consume.

---

## 7. Inventory interaction

Unchanged Phase 6 rules:

- Pending order does **not** decrement `Product.stock`.
- Available = physical − active unexpired reservations.
- Payment consumes reservation and decrements stock **once**.
- Duplicate webhook: stock unchanged.
- Concurrent last unit: one `201`, one `409`; winner pay → stock `0`.

---

## 8. Reservation interaction

- Checkout session refused if reservation expired or order not `pending_payment`.
- Sweeper still marks overdue reservations/orders `expired`.
- A late Stripe “paid” event on an expired order does **not** pay and does **not** consume.
- Abandoned Checkout leaves `pending_payment` until the 15-minute window.

---

## 9. Security controls

- Secret key and webhook secret: server-only (config / env). Not in SPA, not in reports, not in `.env` (absent).
- HttpOnly `nexora_sid` / `nexora_oid`. No Stripe tokens in `localStorage`.
- Order ownership: authenticated `userId` match, or HMAC guest token (`v1:` prefix rejected as raw). Cross-user pay/get → 401/404. Guest cannot pay an account order.
- Client `unitPrice` / `total` / `currency` / `qty` / product id on checkout-session are ignored.
- Stripe cents from Prisma `Decimal` (`mul(100)`), not IEEE floats.
- Currency locked to `usd` (catalog `$`).
- Origin guard on checkout-session; webhook is outside that router (Stripe sends no matching origin).
- Checkout rate limit 8/15m unchanged.
- Helmet CSP unchanged (`script-src 'self'`). No Stripe.js.
- Open-redirect guard: frontend only follows `https://checkout.stripe.com` / `*.stripe.com`.
- Phase 5 hardening preserved (413/414, no CORS `*`, no-store on orders, generic errors).

---

## 10–11. Tests executed (exact totals)

**A. Existing NEXORA regression** (`node server/scripts/regression.js` against `http://127.0.0.1:3000`)

**59 passed / 59 executed / 0 failed.**

Previous baseline **58/58** is preserved. The extra passing check is “no stripe secrets in frontend”; `app.js?v=18` → `app.js?v=19` because payment plumbing landed in `app.js`.

**B. Stripe suite** (`node server/scripts/stripe-regression.js`, `STRIPE_MOCK=1`, official webhook signing)

**56 passed / 56 executed / 0 failed.** `liveStripe: false`.

Covered vs prompt items:

1. pending order creation  
2. Checkout Session creation (hosted URL)  
3. unauthorized / cross-user payment  
4. invalid / missing order id  
5. expired order payment attempt  
6. invalid + missing webhook signature  
7. valid successful webhook  
8. duplicate webhook  
9. payment failure event  
10. abandoned checkout stays pending  
11. inventory decrement exactly once  
12. reservation consumed exactly once  
13. concurrent last-unit reservation  
14–16. price / total / currency tampering (HTTP body ignored; bad webhook amounts/currency declined)  
17. cross-user payment  
18. already-paid session 409  
19. expired reservation webhook does not pay  
20. legacy `placed` unchanged  
21–24. auth, cart, order, security still in suite A (59/59)

**C. Live Stripe network tests: 0.**

---

## 12. Live Stripe test status

| Check | Status |
|---|---|
| `STRIPE_SECRET_KEY` in env / `.env` | missing |
| `STRIPE_PUBLISHABLE_KEY` | missing |
| `STRIPE_WEBHOOK_SECRET` | missing |
| Real Checkout Session on Stripe | **not executed** |
| Real webhook delivery / tunnel | **not executed** |

---

## 13. Failures and fixes

- Guest access cookie was omitted from `placeOrder`’s return value; checkout-session then 401’d. Fixed: return `guestToken` internally, set HttpOnly `nexora_oid`, strip it from JSON.
- First Stripe run hit a stale `orderService` export (`assertOrderAccess` / `getForRequester`). Exports restored.
- Checkout limiter 8/15m is unchanged. Stripe tests isolate jars via `X-Forwarded-For` (trust proxy already on); production limiter was not raised.

---

## 14. Files changed

- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260907140000_stripe_payments/migration.sql`
- `server/src/app.js` (new — Express app factory; webhook before JSON)
- `server/src/index.js` (listen + sweeper only)
- `server/src/config/index.js`
- `server/src/utils/errors.js` (503)
- `server/src/middleware/error.js`
- `server/src/services/orderService.js`
- `server/src/services/stripeService.js` (new)
- `server/src/services/paymentService.js` (new)
- `server/src/controllers/orderController.js`
- `server/src/controllers/paymentController.js` (new)
- `server/src/routes/orders.js`
- `server/.env.example` (placeholder names only)
- `server/package.json` / `package-lock.json` (`stripe@^16.12.0`)
- `server/scripts/regression.js`
- `server/scripts/stripe-regression.js` (new)
- `app.js` (redirect + return status plumbing)
- `index.html` (`app.js?v=19` only)
- `NEXORA-PHASE8-STRIPE-REPORT.md` (this file)

---

## 15. Files intentionally untouched

- `styles.css` (still 40333 bytes, `?v=15`)
- Checkout overlay markup / form layout (lede text unchanged)
- Cart drawer, nav, cards, dashboard chrome, typography, motion
- `api.js`, `catalog.js`
- No Stripe.js, no Admin, no Vercel, no Railway, no deploy
- No `prisma migrate reset`, no table drops

---

## 16. Remaining blockers

Unavoidable external step for **live** test-mode verification:

1. Create a Stripe test-mode account and set **server-side only**:  
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_PUBLISHABLE_KEY` (not required for hosted Checkout in this design), `STRIPE_CURRENCY=usd`.
2. Point a webhook at `POST /api/webhooks/stripe` (or a tunnel). Do not put the webhook secret in the browser.
3. Restart Express **without** `STRIPE_MOCK`.
4. Place a test order, pay with Stripe test cards, confirm webhook → `paid`, stock decremented once, duplicate delivery idempotent.

Until then, claiming a live Stripe charge would be false.

Stopped. No Admin, no deploy, no UI redesign.
