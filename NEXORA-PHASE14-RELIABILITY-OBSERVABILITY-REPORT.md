# NEXORA Phase 14 — Reliability, observability, backup/recovery

**Status: IMPLEMENTED locally. NOT DEPLOYED.**  
No Vercel, Railway, Supabase, or Stripe cloud changes. Credentials were not invented.

**STOP.** Phase 15 was not started.

Customer UI remains locked (`styles.css` **40333**, `styles.css?v=15`, `app.js?v=19`). Admin UI files were not edited.

---

## 1. Reliability changes

- Fail-closed production boot still names missing variables (`PORT`, `DATABASE_URL`, `SESSION_SECRET`, `SUPABASE_*`, Stripe, `PUBLIC_ORIGIN`) without printing values.
- Production start pings the database before listen; unreachable `DATABASE_URL` exits without dumping the URI.
- Process lifecycle extracted to `server/src/lifecycle.js` (`start` / `shutdown`).
- Draining flag stops new work (including Stripe webhooks) with **503** so clients/Stripe retry.
- Reservation sweeper is single-flight (no overlapping ticks) and skips ticks while draining.
- Prisma unique-constraint noise on duplicate Stripe events is not logged as a server error.
- Cart merge locks cart rows (`FOR UPDATE`) inside the existing transaction.
- Order transitions go through an explicit state machine (`server/src/services/orderState.js`).
- Prisma connection/timeout codes map to **503/409/404** without SQL in the HTTP body.

---

## 2. Shutdown behavior

On **SIGTERM** / **SIGINT** / uncaught exception:

1. `runtime.draining = true` (new HTTP except `/api/live` → 503)
2. Stop reservation sweeper interval
3. `server.close()` — stop accepting, wait for in-flight requests
4. Bounded timeout **15s**, then exit 1
5. `prisma.$disconnect()`
6. Exit 0 on clean close

`uncaughtException` logs a redacted error and runs the same shutdown. `unhandledRejection` is logged, not used as a secret dump.

Verified: isolated HTTP server closes; subsequent fetch fails. Test shutdown does **not** disconnect the shared Prisma singleton used by other suites.

---

## 3. Database safety

- Prisma `$transaction` remains the write boundary for orders, reservations, payments, adjustments, cart merge.
- Engine errors are redacted; `P2002` → 409, `P2025` → 404, `P2034` → 409, connectivity/timeout → 503 `"Service unavailable"`.
- HTTP 500 body is always `"Internal server error"` (no stack, SQL, paths, or secrets).
- No automatic reset, recreate, truncate, or “repair” job.
- Readiness and health ping `SELECT 1` only.

---

## 4. Transaction audit

| Flow | Transaction | Failure |
| --- | --- | --- |
| Place order | Lock cart + products → expire overdue → availability → create order + **active** reservations → clear cart | Rollback: no order, no reservation (tested 409) |
| Confirm paid / Stripe fulfill | Lock products + order → refuse non-`pending_payment` → decrement `stock` iff `gte qty` → consume reservations → `paid` | Rollback: stock and reservations unchanged; Stripe event row deleted so Stripe can retry |
| Cancel pending | Lock → release **active** reservations → `cancelled` | Idempotent if already cancelled |
| Dispatch | Lock order → `paid` → `dispatched` only | Idempotent if already dispatched |
| Expire sweeper | Lock products → expire **active** overdue reservations → `pending_payment` → `expired` | Errors logged; server stays up |
| Inventory adjust | Lock product → expire overdue → refuse negative / below reserved → write stock + adjustment | Idempotency key replay |
| Cart merge | Lock cart ids → merge lines → drop OOS | Single transaction |

Stripe Checkout Session create still happens **after** the prepare transaction (external I/O). If the following `stripeCheckoutSessionId` update failed, the session metadata still carries `orderId` and a later webhook can fulfill. Documented limitation — no schema change.

---

## 5. Reservation sweeper

- Runs once at process start, then every **60s**
- Mutex: overlapping ticks return immediately
- Skips while draining
- Errors increment `sweeperFail` and are logged; they do not crash Node
- Only `status=active` and `expiresAt <= now`
- Does not touch paid/consumed/released rows
- Order expiry is `updateMany` **only** `pending_payment`
- Database remains authoritative across Railway restarts (next boot ticks immediately)

---

## 6. Stripe webhook reliability

Unchanged authority: signature via `constructEvent`, no public pay path.

| Case | Behavior |
| --- | --- |
| Bad/missing signature | 400 |
| Duplicate `event.id` | 200 `{ duplicate: true }`, no stock change |
| Already paid | `confirmPaidOrder` idempotent, no extra decrement |
| Expired / cancelled / placed | 409 internally → 200 declined (no pay) |
| Amount/currency mismatch | not paid |
| DB failure after insert | event row deleted → Stripe retry |
| Process draining | **503** (retry) |

Webhook is mounted with `express.raw` **before** JSON and is **not** behind `apiLimiter`.

---

## 7. Order state machine

Legal transitions (`server/src/services/orderState.js`):

```
pending_payment → paid          (verified Stripe / confirmPaidOrder)
pending_payment → cancelled     (approved cancel)
pending_payment → expired       (sweeper)
paid            → dispatched    (admin dispatch)
paid            → paid          (idempotent confirm)
cancelled / dispatched          (idempotent self)
expired         → *             forbidden
cancelled       → paid          forbidden
dispatched      → paid          forbidden
placed          → *             terminal / historical
```

No endpoint accepts arbitrary status. No refund invention. Admin still cannot mark paid.

---

## 8. Inventory invariants

`available = max(0, physical − active unexpired reservations)`

Paths that change `Product.stock`: payment consume (decrement with `stock >= qty`), admin adjustment (floor at reserved). Place/cancel/expire **do not** change physical stock.

Concurrent last-unit checkout and concurrent admin +2/+2 both remain serialized with `FOR UPDATE`.

---

## 9. Idempotency

| Operation | Retry-safe? |
| --- | --- |
| Stripe webhook (`StripeEvent.id`) | Yes |
| `confirmPaidOrder` | Yes (`alreadyPaid`) |
| Cancel pending / dispatch | Yes |
| Inventory adjust with `idempotencyKey` | Yes |
| Place order | **No** — a second POST creates another pending order if stock remains. Documented; no schema change |
| Checkout session create | Reuses open Stripe session when amount matches |

In-memory rate limits are **per Node process**, not distributed across Railway replicas.

---

## 10. Logging

JSON lines: `ts`, `level`, `scope`, plus safe fields.

Access log (skips `/api/live|ready|health`): `requestId`, `method`, path **without query**, `status`, `ms`. No bodies, cookies, or Authorization.

Redaction: postgres URIs, Bearer, `sk_*`, `whsec_*`, JWTs, `password=/token=/secret=`, `/home/...` paths, SQL verb dumps.

---

## 11. Request correlation

- `X-Request-Id` on every response
- Honors inbound id if `^[A-Za-z0-9._-]{8,128}$`, otherwise generates 24 hex chars
- Never used as authentication
- Included on 500 logs only as the id

---

## 12. Health / readiness

| Endpoint | Meaning | Prod body |
| --- | --- | --- |
| `GET /api/live` | Process up (no DB). Stays 200 while draining | `{ "status": "ok" }` |
| `GET /api/ready` | Not draining + DB ping | `{ "status": "ok" }` or 503 `{ "status": "error" }` |
| `GET /api/health` | Railway check: DB ping; 503 if draining or DB down | `{ "status": "ok" }` / `{ "status": "error" }` |

Non-prod health still adds `database`, `databaseKind`, `supabaseAuth`. Non-prod ready may include in-memory `metrics` (not in production). No credentials.

`/api/live` and `/api/ready` are not rate-limited. `/api/health` is skipped by `apiLimiter`.

Railway `healthcheckPath` remains `/api/health`.

---

## 13. Rate limiting

Unchanged numeric limits:

- Auth 20 / 15 min
- API 120 / min (skips live/ready/health)
- Checkout 8 / 15 min
- Admin 60 / min
- Bootstrap 5 / 15 min

**Limitation:** `express-rate-limit` is in-memory and **process-local**. Multiple Railway replicas do not share counters. Stripe webhooks are not limited.

---

## 14. Backup / recovery readiness

**Backups are not configured here** (no Supabase project). Do not pretend they are.

Critical data: `User`, `Session`, `Product`/`ProductSpec`/`Finish`, carts, reservations, `Order`/`OrderItem`, `InventoryAdjustment`, `StripeEvent`, CMS, `AuditLog`.

Migrations (9) are reproducible via `npx prisma migrate deploy` only — never reset.

Conceptual restore order:

1. Restore PostgreSQL (Supabase PITR / dashboard backup — operator)
2. `prisma migrate deploy` if the dump is behind
3. Configure Auth keys on Express
4. Set Railway env (`PUBLIC_ORIGIN`, Stripe webhook URL, etc.)
5. Verify `/api/ready`, login/session
6. Run `integrity:check` (read-only)
7. Confirm Stripe webhook endpoint
8. Regression suites
9. Resume traffic

No destructive automated restore is implemented.

---

## 15. Data integrity checks

`npm run integrity:check` → `server/scripts/data-integrity-check.js`

Read-only. Never “fixes” rows.

Detects: negative stock; active reservation on terminal order; consumed reservation on unpaid order; paid missing `paidAt`; Stripe paid missing payment metadata; adjustment `resulting ≠ previous + delta`; reservation missing product/order; `pending_payment` without an active reservation.

This run: **9/9 OK**.

---

## 16. Security scan

Frontend (html/js/css/`config.js`): no live `sk_live_`, `whsec_`, service-role assignments.  
Reports and config examples use names only.  
`.env` remains gitignored.  
Production config failures mention **variable names**, not values.

---

## 17. Exact files changed

**New**

- `server/src/runtime.js`
- `server/src/lifecycle.js`
- `server/src/services/orderState.js`
- `server/src/middleware/requestId.js`
- `server/src/middleware/requestLog.js`
- `server/scripts/data-integrity-check.js`
- `server/scripts/reliability-regression.js`
- `NEXORA-PHASE14-RELIABILITY-OBSERVABILITY-REPORT.md`

**Updated (backend/ops only)**

- `server/src/index.js`, `app.js`, `config/index.js`
- `server/src/db/prisma.js`
- `server/src/controllers/healthController.js`, `paymentController.js`
- `server/src/routes/index.js`
- `server/src/middleware/error.js`, `security.js`
- `server/src/utils/log.js`
- `server/src/services/inventoryService.js`, `orderService.js`, `cartService.js`
- `server/package.json` (`integrity:check`, `reliability`)
- `server/scripts/production-readiness-check.js` (reads lifecycle for listen/shutdown)

**Not changed:** `styles.css`, `index.html`, `app.js`, `admin.js`, `admin.css`, `catalog.js`, Prisma migrations.

---

## 18. Exact test results

| Suite | Result |
| --- | --- |
| Customer `regression.js` | **59/59** |
| Stripe `stripe-regression.js` | **56/56** (mock; **LIVE STRIPE = NOT EXECUTED**) |
| Admin foundation | **59/59** |
| Admin API | **89/89** |
| Admin UI | **45/45** |
| Supabase cutover | **18/18** (**LIVE SUPABASE = NOT EXECUTED**) |
| Reliability `reliability-regression.js` | **48/48** |
| Data integrity | **9/9 OK** |
| Production readiness | structural **47/47**, env **3/12**, **READY false** |

Reliability coverage: graceful shutdown, missing prod config names, request id, live/ready/health, drain 503, webhook drain, rollback, expiration, illegal transitions, admin inventory concurrency + idempotency, 500 sanitization, secret scan, integrity.

---

## 19. Known operational limitations

- Rate limits are not shared across Railway instances.
- Place-order is not idempotent.
- Stripe session create is outside the DB transaction (webhook still authoritative).
- In-memory metrics are per process and are **not** exposed in production HTTP.
- No distributed tracing vendor.
- Local Postgres in this workspace is not production Supabase.

---

## 20. Items requiring real cloud credentials later

- Supabase PITR / backups and Auth
- Live Stripe webhook endpoint on Railway
- Vercel + Railway deploy and `PUBLIC_ORIGIN`
- Multi-instance rate limiting (if ever required)
- Production log drain (Railway logs)

---

## Bottom line

NEXORA now fails closed, shuts down cleanly, keeps Stripe as payment authority, keeps inventory math in transactions, and has read-only integrity + request correlation. Nothing was deployed. Live cloud integrations remain untested because credentials are absent — and were not faked.
