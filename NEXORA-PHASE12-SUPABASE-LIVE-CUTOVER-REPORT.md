# NEXORA Phase 12 — Supabase live cutover report

**Status: PREPARED, NOT EXECUTED.**  
This environment has **no** real Supabase project credentials. Live persistence and GoTrue were **not** connected. Credentials were **not** invented. Nothing was deployed.

**STOP.** Phase 13 (Vercel / Railway / DNS / live Stripe invention) was not started.

---

## Verdict

| Track | Result |
| --- | --- |
| Live Supabase PostgreSQL | **Not executed** — no `DATABASE_URL` pointing at `*.supabase.co` / pooler |
| Live Supabase Auth (GoTrue) | **Not executed** — no `SUPABASE_URL` / anon / service-role keys |
| Local Prisma `nexora` @ `127.0.0.1:5432` | **Connected**, schema up to date (9 migrations) |
| Production boot without live config | **Refuses** (Auth required; DB kind must be `supabase`) |
| Customer / Stripe / Admin regressions | **All green** against local DB + mock Stripe |
| Customer UI / `styles.css` / Admin UI | **Unchanged** |

`GET /api/health` (non-prod, after restart):

```json
{"status":"ok","database":"connected","databaseKind":"local","supabaseAuth":"not_configured"}
```

`npm run cutover:check` → **18/18**, `liveSupabaseAttempted: false`.

---

## Why live cutover did not run

Inspected (names / host-kind / lengths only — **no secret values printed**):

- Process environment: **no** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `server/.env` keys only: `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`, `ORDER_RESERVATION_MINUTES`.
- Prisma datasource: PostgreSQL database `nexora` at **`127.0.0.1:5432`** (local).
- No Docker, no `supabase` CLI — cannot `supabase start` a local stack either.

Prompt 12 forbids fabricating a project, hardcoded keys, or claiming a live connection that was not actually made. Local storefront + Admin APIs therefore stay on the existing bcrypt + Prisma path.

---

## What was prepared (code / config)

### Detection (no fake “configured”)

`server/src/config/index.js`:

- `looksLikeSupabaseUrl` — real `https://<ref>.supabase.co` only. Placeholder `YOUR_PROJECT` (underscore) does **not** count.
- `looksLikeSecret` — length ≥ 32 and not a placeholder / `CHANGE_ME` / `example` / `xxx`.
- `supabaseConfigured` — **all three** of URL + anon + service-role must pass.
- `databaseKind` — `local` | `supabase` | `other` | `missing` from `DATABASE_URL`.
- **Production refuses to boot** unless Auth is configured **and** `databaseKind === "supabase"`. Verified:

  `NODE_ENV=production` → process throws  
  `Supabase Auth must be configured in production (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)`

Empty / example keys therefore cannot silently look “live”.

### Health (non-prod extra fields only)

`server/src/controllers/healthController.js` adds `databaseKind` and `supabaseAuth` (`configured` | `not_configured`) outside production. Production health remains `{ status: "ok" }` / `{ status: "error" }`.

### `.env.example`

Documents (names only, no real secrets):

- Pooled `DATABASE_URL` port **6543**, `pgbouncer=true`, `sslmode=require`
- Direct `DIRECT_URL` port **5432**, `sslmode=require` (migrations)
- `npx prisma migrate deploy` only — **never** `migrate reset` / drop / truncate
- Server-only Auth keys; production boot rule
- Never commit `.env`; never put service-role / Stripe secrets in the browser

### Cutover check

- Script: `server/scripts/supabase-cutover-check.js`
- npm: `cutover:check`
- Never prints secret values
- Live GoTrue/pooler probes run **only** when `supabaseConfigured && databaseKind === "supabase"`
- This run: LIVE skipped with reason recorded in JSON summary

### Unchanged by design

- Prisma kept. Browser is **not** a Supabase database client.
- Express HttpOnly `nexora_sid` session. No localStorage JWT. No service-role in the browser.
- Existing-user bridge (when Auth **is** configured): bcrypt + no `authId` → GoTrue `createUser` / sign-in → store `authId`, **null out** `passwordHash`. Passwords are never copied as plaintext.
- Auth clients (`server/src/services/supabase.js`) throw **503** if used while not configured.
- Customer UI locked: `styles.css` **40333**, `styles.css?v=15`, `app.js?v=19`. Admin UI not modified this phase.

---

## Local database snapshot (not live)

| Check | Value |
| --- | --- |
| `prisma migrate status` | 9 migrations, **schema is up to date** |
| Products | **64** |
| Inactive products | 0 |
| Negative stock | 0 |
| `placed` orders (must not auto-convert to paid) | **4** preserved |
| Users | 61 (regression fixtures) |
| Users with `passwordHash` | 61 |
| Users with `authId` | **0** (no GoTrue link — expected) |

Required public tables present: User, Session, Product, ProductSpec, Finish, Cart, CartItem, Wishlist, Order, OrderItem, InventoryReservation, InventoryAdjustment, Review, Article, Subscriber, Drop, DropItem, AuditLog, AdminBootstrapState, StripeEvent.

No `migrate reset`. No truncate. No seed overwrite of a remote database (none connected).

---

## Auth / session contract (ready for live, running local)

| Mode | Register / login |
| --- | --- |
| `supabaseConfigured === false` (this env) | Local bcrypt (`passwordHash`). Sessions via Express cookie. |
| `supabaseConfigured === true` (when keys exist) | GoTrue via **server** anon + service-role clients. App `User.authId` linked. |

Bridge (live only, not executed here):

1. Existing row with bcrypt hash and **no** `authId`.
2. Verify password with bcrypt.
3. Provision / sign in on GoTrue with **the same password the user just typed** (not a dumped hash).
4. Write `authId`, set `passwordHash = null`.

Session after either path: HttpOnly `nexora_sid`. Frontend never stores Supabase JWTs.

---

## Tests run this phase

| Suite | Result | Notes |
| --- | --- | --- |
| `scripts/supabase-cutover-check.js` | **18/18** | LIVE skipped |
| `scripts/regression.js` (customer) | **59/59** | `supabaseConfigured: false` |
| `scripts/stripe-regression.js` | **56/56** | mock Stripe; **live Stripe 0** |
| `scripts/admin-regression.js` | **59/59** | |
| `scripts/admin-api-regression.js` | **89/89** | |
| `scripts/admin-ui-regression.js` | **45/45** | static + API gates; UI files not edited |
| Production config boot | **refused** without live Auth | |
| Frontend secret scan | **clean** | index, app, api, catalog, styles, admin.js, admin.css |
| `styles.css` size | **40333** | locked |

LIVE GoTrue health, LIVE Prisma against pooler, LIVE register/login/cart-merge against Auth: **not run**.

---

## Security (no regression intended)

- No `SUPABASE_SERVICE_ROLE_KEY` / Stripe secrets / `SESSION_SECRET` / `DATABASE_URL` in frontend source.
- No `supabase-js` / `createClient(` in customer or Admin JS.
- Helmet / CSP / origin allowlist / hashed cart tokens / generic auth errors unchanged.
- Admin still cannot mark paid; inventory only via adjustments; last-admin demote still blocked (API suite).
- Reports and logs in this phase do not contain secret values.

---

## Exact blocker to complete LIVE cutover

Provide **server-only** environment (do not paste into chat, Git, frontend, or this report):

1. `SUPABASE_URL=https://<project-ref>.supabase.co`
2. `SUPABASE_ANON_KEY` (real anon JWT)
3. `SUPABASE_SERVICE_ROLE_KEY` (real service-role JWT — **server only**)
4. `DATABASE_URL` pooled: `...pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`
5. `DIRECT_URL` direct: `...db.<ref>.supabase.co:5432/postgres?sslmode=require`

Then, on the server (never reset):

```bash
# after writing real values into server/.env (not committed)
npx prisma migrate deploy
npm run cutover:check
# expect liveSupabaseAttempted true, live Prisma ping, GoTrue health
NODE_ENV=production node src/index.js   # should boot only with the above
```

If the target database **already has data**, do not overwrite it. Seed **only** if the catalog is empty and seeding is explicitly safe. Never `prisma migrate reset`.

Existing local bcrypt users will bridge on first successful login after Auth is on. Do not bulk-copy password hashes into GoTrue.

---

## Out of scope (honored)

- No Vercel / Railway / custom domain / DNS.
- No invented live Stripe keys or live payment e2e.
- No customer storefront or Admin UI redesign.
- No `styles.css` / `app.js` cache-bust bump.
- No Phase 13.

---

## Bottom line

NEXORA is **ready to attach** to real Supabase Auth + pooled Postgres without rewriting the app: Prisma stays, sessions stay Express cookies, production **fails closed** if the attachment is missing. In **this** workspace the attachment was never possible, so the honest result is **local-only verification + live cutover blocked on credentials**.
