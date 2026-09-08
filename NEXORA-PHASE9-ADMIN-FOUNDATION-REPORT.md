# NEXORA — Phase 9 Admin foundation + RBAC (prompt 5/30)

**ADMIN FOUNDATION IMPLEMENTED.**  
No Admin CRUD APIs. No Admin UI. No deploy.

Customer website, Stripe webhook authority, and reservation/order rules are unchanged.

---

## Admin architecture

An administrator is a **normal Express session user** (`nexora_sid` HttpOnly) whose `User.role` is `admin` **in the database**.

```
Request
  → originGuard (mutations)
  → attachUser (session cookie → user id)
  → /api/admin/*
       → no-store
       → adminLimiter
       → requireAdmin: reload User.role from Postgres
            unauthenticated → 401
            role ≠ admin     → 403
            admin            → continue
```

The browser cannot grant Admin. `role` in JSON/query/headers/localStorage is ignored. `requireAdmin` never trusts `req.body.role` or the cached session payload; it re-reads `User.role`.

Customer routes do **not** use `requireAdmin`. They keep existing ownership checks.

---

## RBAC design / role model

| Role | Meaning |
|---|---|
| `customer` | Default. All existing and newly registered users. |
| `admin` | Elevated. Set only by one-time HTTP bootstrap or the server-side CLI. |

`normalizeRole()` treats any value other than `admin` as `customer`. There is no permissions table. Capability names are documented for Prompt 6; they are **not** independently assignable yet.

`GET /api/me` may include `role` (`customer` | `admin`). The customer SPA does not display it. Hashes and secrets are never included.

---

## Database migration

`20260907160000_admin_rbac` — **additive, deployed, never reset.**

- `User.role TEXT NOT NULL DEFAULT 'customer'` + index  
- `AuditLog` (actorId, action, targetType, targetId, metadata, createdAt)  
- `AdminBootstrapState` one row `id=http` for one-time HTTP promote  

Existing users remained `customer` unless a later test/CLI promote ran. No tables dropped. 64 products remain.

---

## Authorization middleware

`server/src/middleware/admin.js` → `requireAdmin`

Mounted on `/api/admin/*` except `POST /api/admin/bootstrap` (authenticated customer + server secret, not already admin).

Unknown `/api/admin/…` paths: customer **403**, admin **404**, anonymous **401**.

---

## Admin API boundary (this prompt)

| Method | Path | Authz | Purpose |
|---|---|---|---|
| POST | `/api/admin/bootstrap` | signed-in user + bootstrap secret | One-time promote |
| GET | `/api/admin/session` | admin | `{ user: { id, email, name, role } }` |
| GET | `/api/admin/capabilities` | admin | Contract map for Prompt 6 |
| GET | `/api/admin/audit` | admin | Paginated audit (no secrets) |

**Not implemented (intentionally):** product CRUD, inventory writes, order lifecycle, mark-paid, customer management, content edits, dashboard stats.

`POST /api/admin/orders/:id` with `{ status: "paid" }` → **404**. Stripe webhook remains the only payment confirmation path.

---

## Admin bootstrap mechanism

Two **server-only** paths. Neither creates users. Neither auto-promotes the first registrant.

1. **HTTP (one-time)**  
   Env (both required): `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_SECRET`  
   `POST /api/admin/bootstrap` `{ "secret": "…" }`  
   - Must already be signed in as that email  
   - Timing-safe secret compare  
   - Consumes `AdminBootstrapState` (`409` on reuse)  
   - Writes `admin.bootstrap` audit row (no secret in metadata)  
   - Unconfigured → **404** (endpoint hidden)  
   - Wrong secret / wrong email → **403**  
   These env vars are **not** set in `server/.env`. They were not invented for production.

2. **CLI**  
   `node server/scripts/promote-admin.js email@domain`  
   Promotes an **existing** user. Audit `admin.promote` / `via: cli`.

---

## Audit log foundation

Append-only `AuditLog`. Customer APIs cannot read it. Metadata is stripped of keys/values matching password/secret/token/service-role/Stripe patterns. Bootstrap writes one row.

---

## Session / security behavior

- Same `nexora_sid` as customers. No second admin cookie.  
- Logout deletes the session row.  
- Expired/invalid session → 401 on Admin.  
- Re-login restores Admin if `User.role` is still `admin`.  
- Demotion in DB takes effect on the next Admin request (role re-fetched).  
- Origin guard unchanged; optional `ALLOWED_ORIGINS` (comma-separated absolute origins) for a future split host. Not hardcoded to localhost. Missing Origin still allowed (same as Phase 5). Invalid Origin → 403.  
- `adminLimiter` 60/min; `bootstrapLimiter` 5/15min. Existing auth/checkout/api limiters untouched.  
- Register/login whitelist **email + password only**. `role: "admin"` in the body is ignored; DB default `customer`. No customer user-update endpoint.

---

## Isolated Admin UI

**None in this workspace.** Earlier reports state Admin had not started; there is no `/admin` SPA, no extra HTML, no client-side role gate to “trust.”

Prompt 7 can consume:

- `GET /api/admin/session` — gate the shell (UX only; server still enforces)  
- `GET /api/admin/capabilities` — which panels to show  
- Prompt 6 CRUD under `/api/admin/products|orders|customers|content|dashboard`  
- `credentials: "same-origin"`; never store `nexora_sid` in JS  

Do not treat hidden buttons as security.

---

## Privilege-escalation tests (executed)

Body `role=admin` on register/login · query `?role=admin` · headers `X-Role` / `X-Admin` · `PATCH /api/me` · `PUT /api/users/:id` · customer calling Admin URLs · fake `{status:paid}` · wrong bootstrap secret · bootstrap reuse · evil Origin · malformed JSON · expired/invalid session. All denied as specified.

---

## Exact test totals

| Suite | Result |
|---|---|
| Existing regression `scripts/regression.js` | **59/59** |
| Stripe `scripts/stripe-regression.js` | **56/56** (still mock; live Stripe not available) |
| Admin foundation `scripts/admin-regression.js` | **59/59** |
| Live Stripe | **0** (unchanged blocker) |
| Live Supabase Auth | **0** (unchanged blocker) |

---

## Failures and fixes

None on the final runs. Suites were executed after `prisma migrate deploy` (additive) and an API restart.

---

## Database integrity (after tests)

| Check | Result |
|---|---|
| Products | 64 |
| Negative stock | 0 |
| Duplicate emails | 0 |
| `placed` orders | still present |
| Stripe order columns | intact |
| Reservations / order items | intact |
| Default role | `customer` |

Local test runs promoted two users to `admin` (explicit prisma promote + HTTP bootstrap against test emails). That is not a production identity and used no fabricated live credentials.

---

## Files changed

- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260907160000_admin_rbac/migration.sql`
- `server/src/config/index.js`
- `server/src/middleware/admin.js` (new)
- `server/src/middleware/security.js`
- `server/src/services/rbac.js` (new)
- `server/src/services/auditService.js` (new)
- `server/src/services/adminService.js` (new)
- `server/src/services/sessionService.js` (`publicUser.role`)
- `server/src/services/authService.js` (explicit `role: customer` on create)
- `server/src/controllers/adminController.js` (new)
- `server/src/controllers/authController.js` (`GET /me` reloads role from DB)
- `server/src/routes/admin.js` (new)
- `server/src/routes/index.js`
- `server/src/utils/validate.js` (`assertEnum`, `pickFields`, `assertOrderId`)
- `server/.env.example` (names only)
- `server/scripts/promote-admin.js` (new)
- `server/scripts/admin-regression.js` (new)
- `NEXORA-PHASE9-ADMIN-FOUNDATION-REPORT.md` (this file)

---

## Files intentionally untouched

- `styles.css` (40333 bytes, `?v=15`)
- `index.html`, `app.js`, `api.js`, `catalog.js` (customer UI lock)
- Checkout overlay, cart, nav, cards, dashboard chrome
- Stripe webhook / `confirmPaidOrder` payment authority
- No Vercel, Railway, DNS, or Admin UI

---

## Remaining requirements for Prompt 6

Implement **authorized** Admin CRUD **behind `requireAdmin` only**:

- Products: view/create/update; controlled inventory adjustments (not raw `stock=` from the browser without rules); activate/deactivate  
- Orders: list/inspect; **allowed** lifecycle only (`dispatched`, cancellation handling). **Never** accept `status=paid` from the client; never fake Stripe  
- Customers: view/inspect; safe account state — **not** arbitrary role changes without an explicit, audited promote path  
- Content: articles, drops, deals metadata already in schema  
- Dashboard: counts / revenue from **paid** orders / inventory summaries  
- Continue writing `AuditLog` for every mutation  
- Keep customer APIs ownership-scoped  

---

## Unavoidable external action (bootstrap only)

To create a real operator Admin in an environment that is not this test DB:

1. Register/sign in as the operator (normal customer account).  
2. Set **server-side only** `ADMIN_BOOTSTRAP_EMAIL` (that email) and `ADMIN_BOOTSTRAP_SECRET`, restart Express, `POST /api/admin/bootstrap` with the secret **once**, then remove the secret from env.  
   **or** run `node server/scripts/promote-admin.js operator@domain` on the server.

Do not put those values in the SPA or git.

Stopped. No Admin CRUD, no Admin UI, no deploy.
