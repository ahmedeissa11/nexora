# NEXORA Phase 17 — Final UX + feature-gap QA

**Status:** complete (local only). **Not deployed.** Phase 16 was not repeated. Not a security audit. Phase 18 not started.

UI lock held: `styles.css` **40333** bytes, `styles.css?v=15`, `app.js?v=19`. Admin visual files untouched. No new design language. No cloud credentials invented. Stripe Checkout + webhook remain the only payment path.

Durable Postgres 17 `nexora`: **64** products. Legacy **`NX-1842` (`placed`)** untouched. Preview: **NEXORA** `nexora-2bdbc5ea` on `0.0.0.0:3000`.

The storefront is ready to move to **production preparation**. It is **not** production-ready: `production-readiness-check` remains **READY false** (local PG, no live Supabase/Stripe keys — none were invented).

---

## 1. Current project state

Vanilla JS SPA + Express + Prisma + local PostgreSQL. Customer journey (Home → Shop → Product → Cart → Account → Checkout → History) was already API-backed after Phase 16. This pass inspected the running app and fixed only remaining functional/UX defects.

## 2. Genuine gaps discovered

| Area | Finding | Verdict |
|---|---|---|
| `index.html` | Duplicate markup after `</html>` | Broken — trimmed |
| Shop `#/shop` vs `#/shop?cat=` | Browser back left the previous category selected | Broken — hash now drives filter, including All |
| Checkout success | Heading “Your order is placed.” when Stripe is absent | Misleading — reserved / pending copy |
| Cart footer | Only Total; subtotal/shipping not shown | Partial — rows added with existing `.total-row` |
| OOS | Card Add / Buy now still looked purchasable | Misleading — disabled + client guard |
| Qty | PDP/QV could increment past stock | Partial — capped to stock |
| Search/filter | `.toLowerCase()` on missing `type`/`blurb` | Fragile — haystack helper |
| Related | Empty “You may also consider” | Partial — section omitted |
| Mobile menu | No Journal / Compare / Your house | Navigation gap — links added, same overlay |
| Newsletter 400 | Toast still said “on the list” | Misleading — validation toast |
| Inventory | `pending_payment` with no active hold (test releases) | Integrity gap — sweeper expires orphans |
| Wishlist API / `/api/search` / fake pay | Not present | Intentionally out of scope |
| Admin UI | Product/order/customer/content/audit already wired | Fully working — no visual change |

## 3. Changes implemented

- Honest checkout outcome (reserved vs paid vs closed checkout); Stripe-unavailable copy never claims paid.
- Shop category follows the hash on back/forward.
- Cart shows Subtotal, Shipping (Complimentary), Total.
- Out-of-stock cannot add or buy now; qty cannot exceed remaining stock.
- Mobile menu can reach Journal, Compare, and dashboard.
- Trailing HTML garbage removed.
- Newsletter errors no longer pretend success.
- Reservation sweeper expires `pending_payment` orders that no longer have an active hold. Regression scripts that release holds now run that sweeper so integrity stays true.

## 4. Files changed

| File | Why |
|---|---|
| `/home/user/index.html` | Trailing garbage; cart totals; reserved success copy; mobile nav |
| `/home/user/app.js` | Hash routing, checkout honesty, OOS, qty cap, cart totals, search safety |
| `/home/user/server/src/services/inventoryService.js` | Expire pending orders with no active reservation |
| `/home/user/server/scripts/regression.js` | After releasing holds, run the sweeper |
| `/home/user/server/scripts/stripe-regression.js` | Same |
| `/home/user/server/scripts/product-completion.js` | Extra UX assertions (49 checks) |

Not modified: `styles.css`, `admin.js`, `admin.css`, Prisma migrations, seed, Stripe webhook, auth cookies.

## 5. Customer UX verification

Home, shop (chips, price, sort, search, pager), category tiles, search overlay, PDP (image, price, compare-at, finish, qty, stock, related), cart, wishlist, compare, account overlay, dashboard, journal, collections, arrivals, deals, atelier, footer subscribe — actions hit existing APIs. Empty states remain quiet copy. Success is toast or overlay. Errors use generic server messages.

## 6. Mobile / responsive verification

Existing 1100px / 760px breakpoints unchanged (CSS lock). Menu button still replaces the desktop nav. Product cards already reveal actions on coarse pointers. Cart/search/checkout overlays already use `min(…, 94vw)` / full-width cart. Compare bar already spans the viewport. Extra menu links use the existing `.mobile-nav a` style.

## 7. Cart verification

Add, same finish qty combine, different finishes stay separate, PATCH qty, DELETE at 0, badge, subtotal/shipping/total, `nexora-cart` cache + DB authority, login merge, logout isolation — unchanged architecture, totals now visible.

## 8. Checkout verification

Cart → `pending_payment` + reservation → Stripe Checkout URL only if `checkout.stripe.com`. Locally unconfigured Stripe: order stays reserved, copy says payment is pending and Checkout was not available. Return query `paid=true` is still ignored. No public `/pay`. No Mark as Paid.

## 9. Account / order verification

Logged-out dashboard does not claim a session. Sign-in via overlay; logout on dashboard. Order list + detail from `GET /api/orders` and `/:id`. Guest return uses the order cookie. Paid is shown only when the backend status is `paid`.

## 10. Admin verification

No visual change. Existing dashboard, products, inventory adjustments, orders (dispatch/cancel), customers, articles, drops, stats, audit remain API-connected. Admin UI regression 45/45. No mark-paid control.

## 11. Tests and exact results

| Suite | Result |
|---|---|
| `scripts/product-completion.js` | **49/49** |
| `scripts/regression.js` (customer) | **59/59** |
| `scripts/stripe-regression.js` | **56/56** (`liveStripe: false`) |
| `scripts/admin-regression.js` | **59/59** |
| `scripts/admin-api-regression.js` | **89/89** |
| `scripts/admin-ui-regression.js` | **45/45** |
| `scripts/supabase-cutover-check.js` | **18/18** (live skipped; credentials not invented) |
| `scripts/reliability-regression.js` | **48/48** |
| `scripts/data-integrity-check.js` | **17/17** read-only |
| `scripts/db-safety-regression.js` | **74/74** (`NX-1842` untouched) |
| `scripts/production-readiness-check.js` | **READY false** — structural 51/51; env blockers expected on local |

## 12. Remaining known limitations

- No live Stripe or Supabase; payment stays pending until a real Checkout + webhook.
- Wishlist and compare stay local; no customer wishlist API.
- Overlay search stays client-side (`/api/search` unused).
- Account overlay remains Email + Password + Continue (locked).
- `app.js?v=19` not bumped (admin-ui lock).
- Not deployed.

## 13. Production preparation

**Yes — the project may move to production preparation.**  
**No — it is not production-ready** until live origin, Stripe, and database are configured for real (without inventing credentials) and `prod:check` reports READY.
