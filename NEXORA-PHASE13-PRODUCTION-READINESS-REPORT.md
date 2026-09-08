# NEXORA Phase 13 — Production readiness report

**Status: PREPARED, NOT DEPLOYED.**  
No Vercel deploy. No Railway deploy. No GitHub connection. No Supabase project. No Stripe account. No DNS. Credentials were **not** invented and were **not** requested as pasted secrets.

**STOP.** Phase 14 was not started.

`npm run prod:check` → **READY false** (structural **47/47**, env **3/12**). That is the correct fail-closed result in this environment.

---

## 1. Final deployment architecture

```
Browser
  → Vercel (static vanilla SPA: HTML/CSS/JS/images/fonts)
      /api/*  ──rewrite (operator, not hardcoded in git)──►
  → Railway  Express  (API only in production)
      → Supabase PostgreSQL (Prisma)
      → Supabase Auth / GoTrue (server-side only)
      → Stripe Checkout + webhook (server-side only)

Admin UI is the same SPA (#/admin) talking to /api/admin/* on Express.
RBAC stays on the server. Browser never holds service-role or Stripe secrets.
```

Preserved:

- Vanilla JS hash-router SPA (no React/Next/Vue, no bundler)
- Prisma
- Express HttpOnly `nexora_sid` (no localStorage JWT)
- Hosted Stripe Checkout (no Stripe.js; CSP `script-src 'self'` unchanged)
- Customer UI lock: `styles.css` **40333**, `styles.css?v=15`, `app.js?v=19`
- Admin visual files not redesigned (`admin.js?v=1`, `admin.css?v=1`)

**Why a Vercel rewrite of `/api` is the recommended production cookie model**

The current browser client uses relative `/api/…` and cookies. `SameSite=Lax` + Origin-guard CSRF **only work as they do today if the browser treats the API as same-site**. A git-committed Railway hostname is forbidden, so `vercel.json` does **not** hardcode a rewrite destination. At deploy time, set a Vercel rewrite:

- Source: `/api/:path*`
- Destination: `https://<railway-host>/api/:path*`

Then leave `NEXORA_API_BASE` empty. Cookies stay `SameSite=Lax`. CORS is unused for the happy path. Stripe `success_url` / `cancel_url` use `PUBLIC_ORIGIN` (the Vercel https origin), not the Railway host.

**Fallback (not default):** browser → Railway directly via public `NEXORA_API_BASE`, `CROSS_SITE_COOKIES=1` (`SameSite=None; Secure`), and `ALLOWED_ORIGINS`. Strict allowlist CORS is implemented for that path. Do not use `Access-Control-Allow-Origin: *`.

Railway production **does not serve the storefront** (`SERVE_STATIC` defaults off when `NODE_ENV=production`). Vercel is the HTML source of truth.

---

## 2. Frontend deployment readiness

| Item | State |
| --- | --- |
| Type | Pure static SPA (hash routes; no SPA path fallback required) |
| Vercel | `vercel.json` + root `package.json` `build` writes `config.js` |
| `.vercelignore` | excludes `server/`, `.env`, markdown |
| API base | `config.js` → `window.NEXORA_API_BASE` (default `""`) |
| `api.js` | prefixes `/api` only when the public base is a real `http(s)` origin |
| Secrets in frontend | none (scanned) |
| localhost API URL | not hardcoded |
| Cache | `app.js?v=19`, `styles.css?v=15` unchanged; `api.js?v=3`; `config.js` `no-store` |

`scripts/write-frontend-config.js` refuses localhost bases when `VERCEL=1`. It never writes secrets.

---

## 3. Backend deployment readiness

| Item | State |
| --- | --- |
| Listen | `process.env.PORT`, bind `0.0.0.0` |
| Shutdown | SIGINT/SIGTERM, stop sweeper, `server.close`, Prisma disconnect |
| `NODE_ENV=production` boot | refuses missing Supabase Auth, non-Supabase DB, weak `SESSION_SECRET`, `STRIPE_MOCK`, missing Stripe secrets, missing `PUBLIC_ORIGIN` |
| Health | `GET /api/health` |
| Local Postgres / `pg_ctlcluster` | not required |
| Railway | `server/railway.toml`, `nixpacks.toml`, `Procfile`, `.nvmrc` **20** |
| Start | `node src/index.js` |
| Release | `npx prisma migrate deploy` only — **never reset** |
| Prisma engines | `native` + `debian-openssl-3.0.x` |

Verified: `NODE_ENV=production` still **refuses to boot** in this workspace (no live keys).

---

## 4. Supabase readiness

Code path is unchanged from Phase 12:

- `supabaseConfigured` requires a real `https://<ref>.supabase.co` URL + non-placeholder anon + service-role keys
- Service-role clients are **server-only** (`server/src/services/supabase.js`); 503 if used while unconfigured
- Production DB kind must be `supabase` (pooler / `*.supabase.co`)
- Existing-user bridge: bcrypt + no `authId` → GoTrue → null `passwordHash`
- Browser is not a Supabase database client

**LIVE SUPABASE = NOT EXECUTED** (no credentials).

---

## 5. Stripe readiness

Existing implementation unchanged in authority:

- Checkout Session created server-side from order snapshots
- Webhook `express.raw` + `constructEvent` (signature required)
- Idempotent `StripeEvent` ids; stock decrements once; expired reservations do not pay
- Secrets never sent to the frontend
- Production forbids `STRIPE_MOCK=1` and requires real secret + webhook secret

Webhook URL at deploy (not configured here): `https://<railway-host>/api/webhooks/stripe`

**LIVE STRIPE = NOT EXECUTED.** Mock suite **56/56**.

---

## 6. Environment variable matrix

### Frontend — PUBLIC (Vercel)

| Name | Required | Notes |
| --- | --- | --- |
| `NEXORA_API_BASE` | No | Empty = same-origin `/api` (recommended). https origin only if calling Railway directly. **Not a secret.** |

### Backend — SERVER ONLY (Railway)

| Name | Required in prod | Notes |
| --- | --- | --- |
| `PORT` | Railway sets | No hardcoded production port |
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | Yes | Supabase **pooler :6543** `pgbouncer=true&sslmode=require` |
| `DIRECT_URL` | Yes | Supabase **direct :5432** `sslmode=require` (migrations) |
| `SESSION_SECRET` | Yes | ≥32 chars, not a placeholder |
| `PUBLIC_ORIGIN` | Yes | https Vercel origin (Stripe return + allowlist). Alias: `FRONTEND_ORIGIN` |
| `ALLOWED_ORIGINS` | Recommended | Comma-separated exact origins. **Never `*`** (boot throws) |
| `SERVE_STATIC` | No | Default **off** in production |
| `CROSS_SITE_COOKIES` | No | `1` only if the browser talks to Railway directly |
| `ORDER_RESERVATION_MINUTES` | No | Default 15 |
| `SUPABASE_URL` | Yes | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | Server only in this architecture |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Never** Vercel / browser / Git |
| `STRIPE_SECRET_KEY` | Yes | **Never** frontend |
| `STRIPE_WEBHOOK_SECRET` | Yes | **Never** frontend |
| `STRIPE_PUBLISHABLE_KEY` | No | Unused (no Stripe.js) |
| `STRIPE_CURRENCY` | No | `usd` |
| `STRIPE_MOCK` | Must be unset | Forbidden in production |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional | One-time promote |
| `ADMIN_BOOTSTRAP_SECRET` | Optional | Server only |

Placeholders live in `server/.env.example` and root `.env.example`. **No real secrets.**

---

## 7. CORS / origin model

- Mutations still require Origin ∈ `{ request host variants ∪ ALLOWED_ORIGINS ∪ PUBLIC_ORIGIN }` or **no Origin** (same-site, curl, Stripe webhook).
- Unknown Origin on POST → **403** (regression still passes).
- CORS headers are emitted **only** for allowlisted Origins, with `Allow-Credentials: true`, reflecting **that** Origin.
- **Never** `*`.
- Preflight: allowlisted Origin → **204**; others get no ACAO.

Recommended production: Vercel rewrite ⇒ Lax cookies, Origin = Vercel, `ALLOWED_ORIGINS`/`PUBLIC_ORIGIN` = Vercel https origin.

---

## 8. Cookie / session model

| Cookie | HttpOnly | Path | Default SameSite | Secure |
| --- | --- | --- | --- | --- |
| `nexora_sid` | yes | `/` | Lax | prod (or if None) |
| `cart_token` | yes | `/` | Lax | prod (or if None) |
| `nexora_oid` | yes | `/` | Lax | prod (or if None) |

No `Domain=` attribute (host-only). Session TTL 14 days. Auth architecture unchanged: Express session after GoTrue (when configured) or local bcrypt.

Verified locally: `Set-Cookie: … HttpOnly; SameSite=Lax` (Secure omitted in development).

`CROSS_SITE_COOKIES=1` switches all three to `SameSite=None; Secure` and requires an allowlist in production.

---

## 9. CSP / security headers

**Express (Helmet)** — unchanged tightness:

- `default-src 'self'`
- `script-src 'self'` (no Stripe.js; hosted Checkout is a top-level redirect)
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data:`
- `font-src 'self'`
- `connect-src 'self'`
- `object-src 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `frame-ancestors 'self'` in production
- `X-Powered-By` disabled
- `trust proxy` 1 (Railway)

**Vercel `vercel.json`** mirrors that CSP plus HSTS, `nosniff`, `SAMEORIGIN`. `connect-src 'self'` matches the rewrite model. If someone uses cross-origin `NEXORA_API_BASE`, they must add that origin to Vercel CSP (not done here; no wildcard).

---

## 10. Migration strategy

- 9 existing Prisma migrations; local schema **up to date**
- Production: **`npx prisma migrate deploy`** as Railway `releaseCommand`
- **Never** `prisma migrate reset` / drop / truncate (not present in deploy files)
- Pooled `DATABASE_URL` for queries; `DIRECT_URL` for migrations
- Row locks (`FOR UPDATE`) for reservations/inventory unchanged
- `User.authId`, `User.role`, reservation and inventory-adjustment indexes present
- Schema not changed except `binaryTargets` for Railway’s OpenSSL 3

If the target database already has data: deploy migrations only; do not seed over it.

---

## 11. Healthcheck

`GET /api/health`

- Production: `{ "status": "ok" }` or `{ "status": "error" }` — no credentials, no env dump
- Non-prod extra: `database`, `databaseKind`, `supabaseAuth` (`configured` | `not_configured`)

This run (non-prod):

```json
{"status":"ok","database":"connected","databaseKind":"local","supabaseAuth":"not_configured"}
```

Railway `healthcheckPath = "/api/health"`.

---

## 12. Logging

Startup/shutdown are JSON `{ scope, port, env }` / `{ scope, signal }` — no URLs with passwords.

500s and sweeper failures go through `server/src/utils/log.js` (redacts postgres URIs, Bearer, `sk_*`, `whsec_`, JWTs). No cookie/token dumps. No stack traces in HTTP bodies (`Internal server error`).

---

## 13. Secret scan

Workspace scan for live-looking `sk_live_`, `sk_test_`, `whsec_`, service-role assignments, JWT blobs:

- **No real credentials** in frontend, HTML, CSS, config, reports, fixtures, or deploy files
- `server/src/utils/log.js` matched only because it contains **redaction regexes**, not secrets
- `.gitignore` / `server/.gitignore` ignore `.env` / `.env.*` and **keep** `.env.example`
- There is **no git repository** in this workspace; nothing was committed

---

## 14. Production readiness check

`cd server && npm run prod:check`

```
structural 47/47
env        3/12
ready      false
liveSupabase false
liveStripe   false
liveDeploy   false
```

Env blockers (expected here; values not printed):

- supabaseConfigured
- databaseKind supabase (this DB is **local**)
- DATABASE_URL not localhost
- looksLikeSupabaseUrl
- stripe configured without mock
- STRIPE_SECRET looks real
- STRIPE_WEBHOOK_SECRET looks real
- PUBLIC_ORIGIN set
- NODE_ENV production

The check **fails rather than claiming readiness**.

---

## 15. Exact tests / results

| Suite | Result | Notes |
| --- | --- | --- |
| `scripts/supabase-cutover-check.js` | **18/18** | LIVE skipped |
| `scripts/regression.js` | **59/59** | `supabaseConfigured: false` |
| `scripts/stripe-regression.js` | **56/56** | `liveStripe: false`, mock |
| `scripts/admin-regression.js` | **59/59** | |
| `scripts/admin-api-regression.js` | **89/89** | |
| `scripts/admin-ui-regression.js` | **45/45** | UI files not visually redesigned |
| `scripts/production-readiness-check.js` | **READY false** | structural 47/47 |
| Production config boot | **refused** | no live Auth |

Local flows exercised by those suites: register → session → `/api/me` → logout; guest cart merge; reservation + expiry; pending_payment; mock Stripe webhook → paid → consume once; Admin session/RBAC/CRUD/audit.

---

## 16. Live integrations that were NOT tested

- Live Supabase PostgreSQL
- Live Supabase Auth / GoTrue
- Live Stripe Checkout or webhooks
- Vercel hosting
- Railway hosting
- Cross-origin cookie (`SameSite=None`) in a real browser
- Vercel `/api` rewrite in a real browser
- Custom domain / DNS / TLS certificates beyond platform defaults

---

## 17. Exact blockers

1. **No Supabase project credentials** in this environment (URL + anon + service-role + pooled/direct URIs).
2. **No Stripe live/test secrets or webhook secret** for production boot.
3. **No `PUBLIC_ORIGIN`** (Vercel https origin does not exist yet).
4. **No Railway or Vercel projects** — and this phase must not create them.
5. Operator must set the **Vercel rewrite** (or, alternatively, public `NEXORA_API_BASE` + `CROSS_SITE_COOKIES`) **without committing hostnames**.
6. Stripe Dashboard webhook endpoint cannot be registered until Railway has a public URL.

---

## 18. Exact steps that remain for an eventual deployment

Do **not** paste secrets into git or chat.

1. Create Supabase project; copy server env names from `server/.env.example`.
2. `npx prisma migrate deploy` against `DIRECT_URL` (Railway release command does this). Seed only if the catalog is empty.
3. Create Railway service with **root directory `server/`**, Node 20, env vars above, health `/api/health`.
4. Point Stripe webhook at `https://<railway>/api/webhooks/stripe`.
5. Create Vercel project on the **repo root** (static). Do not deploy `/server` to Vercel.
6. Set Vercel rewrite `/api/:path*` → Railway. Leave `NEXORA_API_BASE` empty.
7. Set Railway `PUBLIC_ORIGIN` + `ALLOWED_ORIGINS` to the Vercel https origin.
8. Confirm production boot, `/api/health`, register/login cookie, cart merge, a **test-mode** Stripe payment, Admin `#/admin`.
9. Only then consider custom DNS.

---

## Diff / lock audit

- `styles.css` **40333**, still `?v=15`
- `app.js?v=19` unchanged requirement
- Admin CSS not edited; Admin JS plumbing only (delegates to `apiSend`)
- Customer layout/hero/cards/nav/footer/checkout visuals not redesigned
- No wildcard CORS
- No localhost production API URL
- No `migrate reset` in deploy config
- No deployment performed

---

## Bottom line

NEXORA is **structurally ready** to put the locked SPA on Vercel and the Express API on Railway in front of Supabase + Stripe, with fail-closed production boot and SameSite=Lax preserved via an `/api` rewrite. In **this** workspace it is **not live-ready**, because the external accounts and secrets do not exist here — and they were not faked.
