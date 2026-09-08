# NEXORA — Phase 10 Admin API / CMS backend (prompt 6/30)

**ADMIN API IMPLEMENTED.**  
No Admin UI. No `styles.css` change. No Vercel / Railway / DNS. No fake Stripe.

Customer website lock, Stripe webhook payment authority, and reservation/order rules are unchanged.

---

## What shipped

Authorized CRUD under `/api/admin/*`, all behind `requireAdmin` (Postgres `User.role` re-read on every request). Mutations write `AuditLog`. Products are archived with `isActive=false` — **never** `prisma.product.delete`. Inventory changes only through signed adjustments. Admin **cannot** mark an order paid.

---

## Authorization

Same boundary as Phase 9:

```
Request
  → originGuard (mutations)
  → attachUser (nexora_sid HttpOnly)
  → /api/admin/*
       → no-store
       → adminLimiter (60/min)
       → requireAdmin: reload User.role
            unauthenticated → 401
            role ≠ admin     → 403
            admin            → handler
```

`POST /api/admin/bootstrap` remains the only `/api/admin` path that is not `requireAdmin` (still authenticated + server secret).

Customer routes do not inherit Admin privileges. Body/query/header `role` is ignored.

---

## Database migration

`20260907180000_admin_catalog` — **additive, deployed, never reset.**

- `Product.isActive BOOLEAN NOT NULL DEFAULT true` + index  
- `InventoryAdjustment` (delta, previousStock, resultingStock, reason, optional unique `idempotencyKey`)  
  - product FK **Restrict** (history cannot evaporate)  
  - actor FK **SetNull**

Existing 64 products stayed active. No tables dropped. `placed` orders untouched.

---

## Admin API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/session` | Phase 9 session |
| GET | `/api/admin/capabilities` | includes `customers.role` |
| GET | `/api/admin/audit` | paginated audit |
| GET | `/api/admin/stats` | aggregates; revenue **paid + dispatched only** |
| GET/POST | `/api/admin/products` | list (incl. archived) / create (allowlist) |
| GET/PATCH/DELETE | `/api/admin/products/:id` | get / update / **archive** |
| POST | `/api/admin/products/:id/inventory-adjustments` | `{ delta, reason }` only |
| GET | `/api/admin/orders` | list / filter |
| GET | `/api/admin/orders/:id` | inspect (no hashes) |
| POST | `/api/admin/orders/:id/cancel` | pending → cancelled; paid/dispatched → cancelRequested |
| POST | `/api/admin/orders/:id/dispatch` | **paid → dispatched** only |
| GET | `/api/admin/customers` | list / search |
| GET/PATCH | `/api/admin/customers/:id` | inspect / `role` allowlist |
| GET/POST/PATCH/DELETE | `/api/admin/articles` | CMS |
| GET/POST/PATCH/DELETE | `/api/admin/drops` | CMS; product refs validated |

**Deliberately absent**

- `POST /api/admin/orders/:id` with `{ status: "paid" }` → **404** (foundation suite still holds)  
- Raw `PATCH` of `stock` / `physicalStock` / `available` → **400**  
- Hard-delete of products  
- Refunds, Admin-triggered Stripe, public pay  
- Admin UI

### Products

Allowlist: id, name, slug, category, collection, type, tag, tagline, price, compareAt, image, meta, blurb, flags, specs.  
Image path: `images/[a-zA-Z0-9._/-]+` (optional leading `/`).  
Admin JSON exposes **physicalStock**, **reservedQty**, **available** separately.  
`DELETE` sets `isActive=false`. Row remains for `OrderItem` / cart / reservation history.

### Inventory

`POST .../inventory-adjustments` `{ delta, reason, idempotencyKey? }`:

1. `SELECT … FOR UPDATE` on the product  
2. Expire overdue reservations  
3. Reject `resulting < 0`  
4. Reject `resulting < reserved`  
5. Write `InventoryAdjustment` + audit  

Optional `idempotencyKey` replays the prior row. Postgres allows multiple `NULL` keys.

### Orders

Explicit transitions only. **Stripe webhook remains the sole payment authority.**

| From | Admin action | To |
|---|---|---|
| `pending_payment` | cancel | `cancelled` (releases reservation; stock unchanged) |
| `paid` | dispatch | `dispatched` |
| `paid` / `dispatched` | cancel | same status + `cancelRequestedAt` (no refund invented) |
| `placed` | cancel or dispatch | **409 terminal** |
| any | `{ status: "paid" }` | **404** (no such route) |

Dispatch of `pending_payment` / `expired` / `cancelled` → 409. Dispatch of already-`dispatched` is idempotent.

### Customers

Safe select: id, email, name, role, timestamps, orderCount.  
**Never** `passwordHash`, session tokens, guest order hashes, Stripe/Supabase secrets.  
`PATCH` role ∈ `{ customer, admin }` only. Last remaining admin cannot be demoted (**409**).

### CMS

Articles: id/kind/date/title/excerpt/body (body = string array). Public `/api/articles` reflects writes.  
Drops + DropItems: `endsAt` ISO; product ids must exist. Home still uses the latest drop and **skips inactive** products.  
Deals remain `Product.compareAt`. Collections remain `Product.collection` (no extra table).

### Stats

`GET /api/admin/stats`

- product totals / active / archived / low physical stock  
- customer vs admin counts  
- orders by status  
- **revenue = sum(total) where status ∈ { paid, dispatched }**  
  `placed`, `pending_payment`, `cancelled`, `expired` are excluded by contract  

---

## Customer catalog (inactive products)

`isActive=false` is treated as gone:

- list / search / related / home featured · arrivals · deals · drop tiles  
- `GET /api/products/:id` → 404 house message  
- cart add/update → 404  
- cart GET hides inactive lines  
- guest→user merge drops inactive lines  
- `placeOrder` → 409 if any line is archived  

---

## Security preserved

Helmet/CSP `script-src 'self'`, `no-store` on Admin, origin guard, hashed cart/order cookies, generic auth errors, no CORS `*`, `checkoutLimiter` still 8/15m, JSON 32kb, URI 2048.  
Admin JSON and audit metadata strip password/secret/token/Stripe/service-role patterns.

---

## Isolated Admin UI

**None.** No `/admin` HTML, no SPA shell, no `styles.css` bump. Prompt 7 can consume session + capabilities + these APIs with `credentials: "same-origin"`. Hidden buttons are not security.

---

## Tests (executed)

| Suite | Result |
|---|---|
| Customer `scripts/regression.js` | **59/59** |
| Stripe `scripts/stripe-regression.js` | **56/56** (mock; live Stripe not available) |
| Admin foundation `scripts/admin-regression.js` | **59/59** |
| Admin API `scripts/admin-api-regression.js` (A–I) | **89/89** |
| Live Stripe | **0** |
| Live Supabase Auth | **0** |

A–I coverage: guest/customer 401/403 · product allowlist CRUD · archive not hard-delete · inventory lock / reserved floor / no negative / no raw stock PATCH / idempotency · orders list/get/cancel/dispatch · mark-paid 404 · `placed` terminal · customers + last-admin + no hash leak · articles/drops CRUD · stats revenue paid-only · inactive hidden from catalog/cart/checkout · audit of mutations · product count restored to 64.

---

## Database integrity (after tests)

| Check | Result |
|---|---|
| Products | 64 |
| `isActive=false` leftovers | 0 |
| Negative stock | 0 |
| `placed` orders | remain (3) |
| Stripe / reservation / order-item columns | intact |

---

## Files changed

- `server/prisma/schema.prisma`  
- `server/prisma/migrations/20260907180000_admin_catalog/migration.sql`  
- `server/src/services/rbac.js` (`customers: view, inspect, role`)  
- `server/src/services/auditService.js` (`appendTx`)  
- `server/src/services/adminCatalogService.js` (new)  
- `server/src/services/adminOrderService.js` (new)  
- `server/src/services/adminCustomerService.js` (new)  
- `server/src/services/adminContentService.js` (new)  
- `server/src/services/adminStatsService.js` (new)  
- `server/src/services/orderService.js` (`dispatchOrder`; reject inactive at checkout)  
- `server/src/services/productService.js` / `homeService.js` / `cartService.js` (`isActive`)  
- `server/src/controllers/adminController.js`  
- `server/src/routes/admin.js`  
- `server/scripts/admin-api-regression.js` (new)  
- `NEXORA-PHASE10-ADMIN-API-REPORT.md` (this file)

---

## Files intentionally untouched

- `styles.css` (40333 bytes, `?v=15`)  
- `index.html`, `app.js`, `api.js`, `catalog.js`  
- Checkout overlay, cart drawer, account overlay, dashboard chrome  
- Stripe webhook / `confirmPaidOrder` payment authority  
- No Vercel, Railway, DNS, or Admin UI

---

Stopped. No Admin UI. No deploy.
