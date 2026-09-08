# NEXORA Phase 15 — Database, migration, and data-model safety

**Status: IMPLEMENTED LOCALLY — NOT DEPLOYED.**

This phase is schema / seed / integrity only. No cloud accounts. No invented credentials. No live Supabase. No customer or Admin UI changes. `styles.css` remains 40333 bytes (`?v=15`). `app.js?v=19` unchanged. Admin visual design untouched. Phase 16 was not started.

---

## 1. Verdict

The durable local database `nexora` on PostgreSQL 17 (`127.0.0.1:5432`) is forward-migrated, seed-hardened, and constraint-checked. Historical migrations were **not rewritten**. One new forward migration was added because production-shaped risks were real (negative stock, invalid statuses/roles, duplicate reservations, accidental product hard-delete via wishlist Cascade).

| Gate | Result |
| --- | --- |
| Historical SQL rewritten | No |
| `prisma migrate reset` / `db push` / startup migrate | Not in production path |
| Seed can wipe production / orders | No — refuses `NODE_ENV=production` and any transactional rows **before** `deleteMany` |
| Isolated empty DB: migrate deploy → generate → seed → integrity → boot | Pass, then temp DB dropped |
| Existing data (`64` products, `NX-1842` `placed`) after new migration | Intact |
| Integrity checker writes / auto-repairs | No — 17 read-only checks |
| Live backup/restore against Supabase | Not executed (conceptual only) |
| Inventory / payment result cache | None |
| Deploy | **Not done** |

---

## 2. What changed (code / schema)

| Path | Change |
| --- | --- |
| `server/prisma/schema.prisma` | `InventoryReservation @@unique([orderId, productId])`; `Wishlist` product FK `onDelete: Restrict` |
| `server/prisma/migrations/20260908120000_data_safety_constraints/` | Forward-only CHECKs, unique index, wishlist Restrict |
| `server/prisma/seed.js` | `assertSeedAllowed()` before any `deleteMany`; refuses production and transactional rows; error text redacts DB URLs |
| `server/scripts/refuse-production.js` | Blocks `prisma:migrate` / `db:setup` when `NODE_ENV=production` |
| `server/scripts/data-integrity-check.js` | +8 read-only checks (roles, statuses, qty, timestamps, duplicate reservations, orphan line items) |
| `server/scripts/db-safety-regression.js` | Focused Phase 15 suite (isolated DB + existing-data + money + FKs) |
| `server/scripts/production-readiness-check.js` | Struct: seed refuses production/transactional rows; start has no migrate/seed; integrity read-only |
| `server/package.json` | `prisma:deploy` remains `migrate deploy`; `db:safety`; `db:setup` / `prisma:migrate` production-guarded |

**Not changed:** `styles.css`, `index.html` asset versions, `admin.css` / `admin.js` visual, payment confirmation paths, rate limits, inventory/payment caching, historical migration SQL.

---

## 3. Migration inventory (chronological)

Provider lock: `prisma/migrations/migration_lock.toml` → `postgresql`.

None of the ten folders contain `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DROP DATABASE`. Applied history was not edited.

| Folder | Intent | Destructive of existing rows? | Reversible? |
| --- | --- | --- | --- |
| `20260830142304_init` | Core catalog, cart, orders, CMS. Original `Order.status` default was `placed`. | No (empty DB) | No — foundation |
| `20260830144327_sessions` | `Session` table, `tokenHash` unique | Additive | Drop table only (not done) |
| `20260830145309_orders_seq` | `nexora_order_seq` for `NX-n` | Additive | Sequence drop only |
| `20260830145320_order_number_seq` | Sequence `START 1842` so live-looking numbers continue | Additive; does not rewrite orders | Not worth reversing |
| `20260830163000_inventory_reservations` | Reservations; new orders default `pending_payment`; **legacy `placed` kept** | Additive | Would drop reservations |
| `20260907120000_supabase_auth_prep` | `User.authId` unique; `passwordHash` nullable | Additive / nullability | Keep |
| `20260907140000_stripe_payments` | `StripeEvent` PK = Stripe event id; checkout session unique | Additive | Keep |
| `20260907160000_admin_rbac` | `AuditLog`, `AdminBootstrapState`, role index | Additive | Keep |
| `20260907180000_admin_catalog` | `Product.isActive` default true; adjustments; featured/drop/arrival | Additive | Keep |
| `20260908120000_data_safety_constraints` | CHECKs + reservation unique + wishlist Restrict | **No row rewrites.** Rejects *new* invalid writes. Applied cleanly on existing `nexora` (64 products, `NX-1842` placed). | `DROP CONSTRAINT` / index (not done) |

`prisma migrate dev --name init` remains a **local** script and is refused when `NODE_ENV=production`. Production / Railway release is `npx prisma migrate deploy` only. Process start is `node src/index.js` — no migrate, no seed, no `db push`.

---

## 4. Data model audit

### 4.1 Money (authoritative Decimal)

| Column | Type |
| --- | --- |
| `Product.price`, `Product.compareAt` | `Decimal(10, 2)` |
| `Order.subtotal`, `Order.shipping`, `Order.total` | `Decimal(10, 2)` |
| `OrderItem.unitPrice` | `Decimal(10, 2)` |

Stripe cents (`paymentService.toCents`): `Prisma.Decimal × 100`, `ROUND_HALF_EVEN`, **reject** if the cent amount is not an integer (so `1.234` cannot become a charge). Verified: `111.11 → 11111`, `19.99 → 1999`, `0.30 → 30`, shipping `0.00 → 0`. Line total `111.11 * 1 + 0` stays `111.11` in Decimal — not JS `0.1 + 0.2`.

JSON APIs still serialize with `Number(decimal.toFixed(2))` for the SPA. That is presentation, not the ledger. Do not use raw JS floats as the source of truth when writing orders.

`Order.currency` defaults to `usd`. No second processor.

### 4.2 Foreign keys and archival

| Child | Parent | `onDelete` | Why |
| --- | --- | --- | --- |
| `OrderItem` | `Product` | **Restrict** | Historical prices/qty must survive; products are archived, not deleted |
| `CartItem` | `Product` | **Restrict** | Same |
| `InventoryReservation` | `Product` | **Restrict** | Same |
| `InventoryAdjustment` | `Product` | **Restrict** | Audit of stock math |
| `Wishlist` | `Product` | **Restrict** (was Cascade; tightened this phase) | Stops `product.delete()` from succeeding just because nobody ordered |
| `ProductSpec`, `Review`, `DropItem` | `Product` | Cascade | CMS/copy, not money |
| `Order`, `AuditLog` actor | `User` | **SetNull** | Orders remain if the account is removed |
| `Session`, `Cart`, `Wishlist` | `User` | Cascade | Session-scoped |
| `OrderItem`, reservations | `Order` | Cascade | Order is the aggregate |
| `StripeEvent.orderId` | — | **No FK** | Intentional: webhooks may arrive for unknown ids; payment-event log must not fail or vanish with order delete |

Admin “delete product” is `isActive = false` (`archiveProduct`). Customer list/PDP query `isActive: true`; archived SKUs 404 with the existing house copy. Order lines keep `name`, `image`, `unitPrice`.

`Finish` is a seed lookup table with **no relations**. Cart/order `finish` is a string. Leaving the unused table is safer than a destructive drop.

### 4.3 Uniques / indexes (justified)

Already present and load-bearing: `User.email`, `User.authId`, `Session.tokenHash`, `Cart.token`, `Order.stripeCheckoutSessionId`, `StripeEvent.id`, `InventoryAdjustment.idempotencyKey`, pagination/filter indexes on `Product`, sweeper indexes on `InventoryReservation (status, expiresAt)` and `(productId, status)`.

**New:** unique `(InventoryReservation.orderId, productId)` — one reservation row per product per order. Prevents double-hold bugs. Not a vanity index.

No additional lookup indexes were added.

### 4.4 CHECKs (new, forward)

- `Product.stock >= 0`
- `User.role IN ('customer','admin')`
- `Order.status` in the known set including legacy `placed`
- Reservation status in `active|released|consumed|expired`
- `qty >= 1` on cart lines, order lines, reservations
- Adjustment `resultingStock = previousStock + delta` and `resultingStock >= 0`
- `paidAt IS NULL OR paidAt >= createdAt`

Existing `nexora` rows satisfied every CHECK before apply.

### 4.5 Inventory / session / Stripe / CMS

- Physical stock lives on `Product.stock`. Available = physical − **active** reservations (computed at request time, row locks `FOR UPDATE`). Pending checkout does not decrement physical stock.
- Sessions: hashed token, expiry index, cascade on user delete.
- Stripe: hosted Checkout only; webhook idempotency via `StripeEvent` unique id; amount checked with `toCents`.
- CMS: `Article`, `Drop`/`DropItem`, `Review` — seed may refresh these **only** when no orders/carts/reservations/wishlists exist.

### 4.6 Query sanity

List endpoints paginate (`page` 1–200, `perPage` ≤ 100). Reservation sweeper uses status+expiry indexes. Admin product list paginates. There is **no** in-memory TTL cache for inventory or payment (no LRU / node-cache). Do not add one: stale available-stock or stale paid flags are worse than a query.

---

## 5. Seed hardening

Previously `seed.js` ran `dropItem/drop/spec/review/article/finish/product.deleteMany()` **before** any order check. That could wipe CMS and then fail `Restrict` on `OrderItem`, leaving a half-destroyed catalog.

Now:

1. Refuse if `NODE_ENV=production` (catalog changes go through Admin; schema via `migrate deploy`).
2. Count orders, order items, reservations, adjustments, Stripe events, carts, cart items, wishlists. If any exist, refuse. **No override flag.**
3. Only then `deleteMany` CMS/catalog tables on an empty transactional database (local bootstrap / isolated test DB).

`package.json` `prisma.seed` still points at this file so a forbidden `migrate reset` cannot silently destroy a DB that already has orders. `db:setup` is production-guarded.

---

## 6. Isolated database drill

Performed against a **temporary** database `nexora_p15_fresh` owned by role `nexora`:

1. Empty DB created.
2. `npx prisma migrate deploy` (all 10).
3. Client already generated from current schema.
4. `node prisma/seed.js` → 64 products.
5. Integrity 17/17 OK.
6. App boot: `/api/health`, `/api/live`, `/api/products` 200.
7. Temp DB dropped (terminate backends, then `DROP DATABASE`). Durable `nexora` was not dropped.

Existing-data drill on durable `nexora`: migrate deploy of the new folder left 64 products and `NX-1842` `placed`. Throwaway `p15-*` rows used for FK/CHECK tests were deleted.

---

## 7. Integrity checker (read-only)

`npm run integrity:check` → `scripts/data-integrity-check.js`. Counts and `$queryRaw` SELECTs only. No `create`/`update`/`delete`. Never auto-repairs.

Original 9 plus:

- invalid user role
- invalid order status
- invalid reservation status
- non-positive qty
- `paidAt` before `createdAt`
- duplicate reservation per order+product
- order item missing product
- cart item missing product

Durable DB: **17/17 PASS**.

---

## 8. Backup / restore (conceptual — not executed)

No live Supabase project exists here. Do **not** invent one.

Recommended when a real project exists:

1. **Backup:** `pg_dump --format=custom --no-owner --no-privileges` of the primary (or a snapshot from the host). Store off-box. Never log connection strings.
2. **Restore drill:** restore into a **new** database name, set `DATABASE_URL`/`DIRECT_URL` only in that process, `prisma migrate deploy` (should be no-op if dump is current), run `integrity:check`, boot `/api/health`.
3. **Never** `migrate reset`, `DROP DATABASE` of production, or restore over the only copy.
4. Point-in-time recovery is a host feature (Supabase PITR / Railway volume snapshots), not an app script. Automated destructive restore is out of scope.

This was not run against cloud.

---

## 9. Residual risks (honest)

- `StripeEvent.orderId` is not a foreign key — orphan event rows are possible; integrity does not treat that as failure.
- `Finish` is unused as a relation; cart finish strings are unconstrained by that table.
- `Review` / `DropItem` still Cascade on product delete — Admin has no hard-delete path, so this is latent.
- JSON money is `Number(toFixed(2))`; keep Decimal at write time.
- Integrity is a scanner, not a lock. CHECKs + Restrict are the write-time net.
- Rate limiters remain in-process (Phase 14). Not a DB issue.
- Production readiness **READY false** until real Supabase + Stripe + `PUBLIC_ORIGIN` + `NODE_ENV=production` exist. Credentials were not invented.
- Local PostgreSQL 17 is a workspace database, not Supabase. Snapshot may not include the server binaries.

---

## 10. Tests (this machine)

| Suite | Result |
| --- | --- |
| Customer regression | **59/59** |
| Stripe (mock) | **56/56** (`liveStripe: false`) |
| Admin | **59/59** |
| Admin API | **89/89** |
| Admin UI | **45/45** |
| Cutover | **18/18** (live Supabase skipped — credentials absent, not invented) |
| Reliability | **48/48** |
| Integrity | **17/17** read-only |
| DB safety | **74/74** |
| Prod readiness | Structural **51/51**, env **3/12**, **READY false**, exit 1 |

UI lock: `styles.css` 40333, `styles.css?v=15`, `app.js?v=19`, `admin.js?v=1`.

`prisma migrate status`: 10 migrations, schema up to date on `nexora`. Temp `nexora_p15_fresh` is gone.

---

## 11. Production path (when Phase 16+ actually deploys)

1. `npx prisma migrate deploy` (Railway `releaseCommand` already).
2. `node src/index.js` — no seed.
3. Catalog edits via Admin. Never seed production.
4. Run `integrity:check` after migrate; investigate, do not auto-fix.
5. Fail closed if `DATABASE_URL` / Stripe / Supabase Auth are missing.

**Do not** `db push`, `migrate reset`, or auto-seed on boot.

---

## 12. Stop

Phase 15 is complete locally and **not deployed**. Phase 16 was not started. No DNS, no GitHub deploy hook, no cloud accounts, no invented secrets.
