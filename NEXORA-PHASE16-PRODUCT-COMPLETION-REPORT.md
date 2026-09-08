# NEXORA Phase 16 — Product completion

**Status:** complete (local only). **Not deployed.** Not a security audit. Phase 17 not started.

UI lock held: `styles.css` **40333** bytes, `styles.css?v=15`, `app.js?v=19`. Admin visual files were not redesigned. No new CSS language. No cloud credentials invented. Stripe Checkout + webhook remain the only payment path; there is still **no** fake mark-paid UI or public `/pay` endpoint.

Durable local Postgres 17 database `nexora` was not seeded, truncated, or reset. Catalog still **64** products. Legacy `NX-1842` (`placed`) left untouched.

Preview API restarted after the route change: process **NEXORA** `nexora-49ef520d` on `0.0.0.0:3000`. `/api/health` → `200` `database: connected`.

---

## What this phase finished

Customer journey (Home → Shop → Product → Cart → Account → Checkout → Order → History) now used existing Express + Prisma APIs. Gaps were wired; working pieces were not rebuilt.

### Checkout (honest, still unpaid until Stripe)

- Overlay lede no longer says payment is simulated. It states stock is reserved, then the shopper continues to Stripe Checkout when payment is available.
- Submit label is **Continue to payment** (`#checkout-submit`).
- Existing `POST /api/orders` still creates `pending_payment` and reserves stock. Existing `POST /api/orders/:id/checkout-session` still redirects only to `checkout.stripe.com`. If Stripe is not configured, the reservation stands as pending — the client never invents `paid`.
- Success panel can send a signed-in shopper to `#/dashboard` (`#checkout-orders`).

### Cart quantity

- Cart lines render the existing `.qty` control (not display-only).
- `+` / `−` call `PATCH /api/cart`. Quantity `< 1` uses the existing `DELETE /api/cart/:id/:finish`. Server still rejects `qty: 0` on PATCH (`400`). Optimistic UI rolls back on error.

### Product page

- PDP now has finish swatches (`.finishes` / `.swatch`) and a quantity stepper (`.qty` / `#pdp-qty`), matching Quick View. Add / Buy now send that finish and qty.

### Account / dashboard / history

- Logged-out copy no longer pretends the visitor is signed in.
- Signed-in profile shows email; **Sign out** lives on the dashboard (`#dash-logout` → `POST /api/auth/logout`). The account overlay stays Email + Password + Continue.
- `GET /api/orders` (array) and `GET /api/orders/:id` drive the order list and line-item detail (`#dash-orders`, `#dash-detail`). Status is labeled; totals come from the server. Guest checkout return still uses the existing order GET (cookie), not a fake paid flag.

### Home / journal / drop / arrivals

- `GET /api/home` supplies featured flags, drop product ids, `drop.endsAt` (clock), and arrivals.
- `GET /api/articles` replaces hardcoded journal notes when the API returns rows. Article body still rendered escaped.
- `mapProduct` now includes additive `isFeatured` / `isArrival` / `isDrop`. Deals remain `compareAt` from the catalog. Empty deals no longer silently fall back to random products.

### Shop chips

- Category chips and collection tiles write `#/shop?cat=…` (All → `#/shop`). The existing hash router already reads `cat`.

### Newsletter

- Thin `POST /api/subscribe` (new route + `subscribeService`). Uses existing `Subscriber` unique email.
- Valid subscribe, including duplicates, always **200** `{ ok: true }` (P2002 swallowed). Invalid email **400**. `authLimiter` + `no-store`. Client still toasts a generic “on the list”.

### Search / wishlist / compare / admin products

- Overlay search still filters the loaded catalog (client already works). `/api/search` left unused rather than duplicating a working UI.
- Wishlist stays local (`nexora-wish`). There is **no** customer wishlist API; none was invented.
- Compare was already local and working.
- Admin product/order/customer/content/audit flows were already complete against `/api/admin/*`. No Mark as Paid. No visual admin redesign.

---

## Files touched (functional only)

| Area | Path |
|---|---|
| Storefront | `/home/user/app.js`, `/home/user/index.html` |
| Subscribe | `server/src/routes/subscribe.js`, `controllers/subscribeController.js`, `services/subscribeService.js`, `routes/index.js` |
| Catalog flags | `server/src/utils/mapProduct.js` |
| Order JSON (additive `subtotal` / `shipping`) | `server/src/services/orderService.js` |
| Tests | `server/scripts/product-completion.js` |

Not modified: `styles.css`, `admin.js`, `admin.css`, Prisma migrations, seed, Stripe webhook, auth cookie model.

---

## Tests (this machine, 2026-09-08)

| Suite | Result |
|---|---|
| `scripts/product-completion.js` | **42/42** |
| `scripts/regression.js` (customer) | **59/59** |
| `scripts/stripe-regression.js` | **56/56** (mock Stripe, `liveStripe: false`) |
| `scripts/admin-regression.js` | **59/59** |
| `scripts/admin-api-regression.js` | **89/89** |
| `scripts/admin-ui-regression.js` | **45/45** |
| `scripts/supabase-cutover-check.js` | **18/18** (live Supabase skipped; credentials not invented) |
| `scripts/reliability-regression.js` | **48/48** |
| `scripts/data-integrity-check.js` | **17/17** read-only |
| `scripts/db-safety-regression.js` | **74/74** (durable `nexora` / `NX-1842` untouched) |
| `scripts/production-readiness-check.js` | **READY false** — structural 51/51; env blockers expected on local PG (no invented cloud/Stripe keys) |

Product-completion checks include honest checkout copy, cart PATCH, PDP markup, home/articles APIs, subscribe 200/duplicate 200/invalid 400, order list+detail, no public pay, UI lock.

---

## Explicitly out of scope (not faked)

- Live Stripe Checkout confirmation or webhook in production.
- Wishlist/compare server APIs.
- CMS rebuild, storefront redesign, `app.js` cache-bust bump (admin-ui lock requires `?v=19`).
- Deploy, DNS, Railway/Vercel, GitHub hooks, new accounts.
- Phase 17.
