# NEXORA — Phase 11 Admin Dashboard UI (prompt 7/30)

**ADMIN DASHBOARD UI IMPLEMENTED.**  
No deploy. No Vercel / Railway / DNS. No new payment providers. Customer storefront visual language unchanged.

---

## Isolation

The Admin Dashboard is a separate full-viewport shell (`#nexora-admin`), not a restyle of shop/PDP/cart/checkout.

- Customer `styles.css` **untouched** (40333 bytes, `?v=15`)
- Customer `app.js?v=19` cache string **kept**
- Admin styles live in `admin.css?v=1` (selectors scoped to `#nexora-admin` / `body.nexora-admin-on`)
- Admin logic lives in `admin.js?v=1`
- On `#/admin*`, the customer `.shell`, ambient, grain, spotlight, and compare bar are hidden
- Leaving admin restores the storefront

---

## Admin routes

Existing hash router intercepts `admin` **before** the customer page list (so `#/admin` no longer falls through to home).

| Hash | Screen |
|---|---|
| `#/admin` | Dashboard (stats + recent orders) |
| `#/admin/products` | Product list (search, sort, active filter, pagination) |
| `#/admin/products/new` | Create product |
| `#/admin/products/:id` | Edit + inventory adjustment |
| `#/admin/orders` | Order list (search, status filter, pagination) |
| `#/admin/orders/:id` | Order detail + allowed actions |
| `#/admin/customers` | Customer list (search, role filter) |
| `#/admin/customers/:id` | Customer detail + role change |
| `#/admin/content` | Articles |
| `#/admin/content/drops` | Drops |
| `#/admin/audit` | Read-only audit log |

Customer routes `#/shop`, `#/product/:id`, `#/collections`, `#/arrivals`, `#/deals`, `#/atelier`, `#/journal`, `#/compare`, `#/dashboard` are unchanged.

---

## Authorization behavior

The UI **never** trusts `localStorage`, query params, or a client role flag.

On every Admin entry:

1. `GET /api/admin/session` (cookie `nexora_sid`, `credentials: "same-origin"`)
2. **401** → Access gate + existing account overlay (`Email + Password + Continue`)
3. **403** → Access Denied (signed in, not admin). Link back to the storefront
4. **200** and `user.role === "admin"` → render the requested screen
5. No Admin list/stats/CMS fetch until session succeeds

After sign-in, if the hash is still `#/admin*`, the dashboard retries session. Logout calls `POST /api/auth/logout`, clears the customer session hook, and returns to `#/`.

The server remains the security boundary (`requireAdmin` re-reads `User.role`).

---

## Screens and API integrations

| Screen | APIs |
|---|---|
| Dashboard | `GET /api/admin/stats`, `GET /api/admin/orders?perPage=8` |
| Products | `GET/POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/:id` |
| Inventory | `POST /api/admin/products/:id/inventory-adjustments` only |
| Orders | `GET /api/admin/orders`, `GET /api/admin/orders/:id`, `POST .../cancel`, `POST .../dispatch` |
| Customers | `GET /api/admin/customers`, `GET/PATCH /api/admin/customers/:id` `{ role }` |
| Content | Articles + Drops CRUD |
| Audit | `GET /api/admin/audit` (read-only) |

Revenue is **exactly** `stats.revenue.total` (paid + dispatched). The UI does not sum catalog prices.

**Not in the UI (because they are not in the API)**

- Mark as Paid / fake Stripe
- Arbitrary order status dropdown
- Refunds
- Raw available-stock editor
- Audit mutate/delete
- Invented CMS types (deals remain `compareAt` on products)

---

## Product / inventory UX

- Allowlisted fields only (id, slug, name, category, collection, type, price, compareAt, image path `images/…`, meta, blurb, flags, specs)
- Create may set **initial physical stock**; edits cannot PATCH stock
- Table shows physical, reserved, available (available is computed, not an input)
- Adjustment form: integer **delta** + **reason**
- Negative delta requires confirmation
- **409** (below reserved / negative) is shown as a conflict, not a stack trace
- Archive confirms; storefront treats `isActive=false` as gone

---

## Orders UX

- Snapshot line prices, not live catalog
- Pending: Cancel (releases reservation; physical stock unchanged)
- Paid: Dispatch, or request cancellation (no refund invented)
- Dispatched: request cancellation only
- `placed`: terminal — no actions
- `POST /api/admin/orders/:id { status: paid }` remains **404**

---

## Customers / CMS / audit

- Safe fields only (no passwordHash, tokens, secrets)
- Promote/demote with confirmation; last-admin **409** from the API
- Articles and drops use real Phase 10 fields
- Audit is paginated, escaped as text, not HTML

---

## Loading / error / empty

Every screen: skeleton while fetching, empty copy, retry on error.  
401 / 403 / 409 / 500 mapped to human messages. No database errors, no stack traces.

After mutations the UI re-fetches the resource (or navigates to the created id). Submit buttons disable while `busy`.

---

## Responsive

- Desktop: sidebar + main + compact top bar
- ≤860px: hamburger, slide-over nav, tables stack into labeled cards, forms single column
- Touch-sized buttons (36px)

---

## Security

- HttpOnly session cookie only
- No secrets in `admin.js` / `admin.css` / HTML
- Admin strings escaped (`& < > " '`) before DOM insertion
- Image src allowlisted to `images/[a-zA-Z0-9._/-]+`
- CSP unchanged (`script-src 'self'`)
- `checkoutLimiter` unchanged (8 / 15m)
- Search is debounced; lists are paginated (20)

---

## Files changed

| File | Change |
|---|---|
| `index.html` | Link `admin.css` / `admin.js`; empty `#nexora-admin` mount. Cache strings `styles.css?v=15` and `app.js?v=19` kept |
| `app.js` | Hash intercept for `admin`; leave admin on customer routes; after sign-in retry; expose session/overlay hooks |
| `api.js` | Attach `error.status` (backward compatible) |
| `admin.css` | **New** — isolated Admin visual system |
| `admin.js` | **New** — dashboard app |
| `server/scripts/admin-ui-regression.js` | **New** |
| `NEXORA-PHASE11-ADMIN-DASHBOARD-UI-REPORT.md` | This file |

**`styles.css`:** not modified (40333 bytes).

---

## Tests executed

| Suite | Result |
|---|---|
| Customer `scripts/regression.js` | **59/59** |
| Stripe `scripts/stripe-regression.js` | **56/56** (mock) |
| Admin foundation `scripts/admin-regression.js` | **59/59** |
| Admin API `scripts/admin-api-regression.js` | **89/89** |
| Admin UI `scripts/admin-ui-regression.js` | **45/45** |
| Live Stripe | **0** |
| Live Supabase Auth | **0** |

UI suite covers: cache lock, isolated mount, no secrets, no mark-paid, inventory adjustment path, session gate, no localStorage role, customer hashes intact, 401/403, stats/list APIs, logout → stale 401, product count 64.

---

## Remaining limitations

- No headless browser in this environment, so click-through layout is verified by markup/CSS/API contracts rather than Playwright screenshots
- Order **date** filter is not in the Phase 10 API, so the UI does not invent one
- Audit filtering beyond pagination is not in the API
- Operators enter via `#/admin` (no customer-nav “Admin” link, to avoid storefront chrome changes)

---

Stopped. No Admin deploy. No Vercel. No Railway. No live credential fabrication.
