# NEXORA — Phase 7 live Supabase cutover (prompt 3/30)

**Verdict: not executed. Do not treat this as a successful live cutover.**

Credentials required for a live connection are **not present** anywhere in the authorized environment. They were not invented. Prisma was not pointed at a fake host. No users, orders, or Auth identities were fabricated.

---

## Environment check (names only — no secret values)

Searched this turn: process environment; `server/.env`; `server/.env.example`; other `.env*` / `secrets.json` / `credentials.json` / `.netrc` under `/home/user`, `/tmp`, `/etc`, `/opt`, `/root`, `/var` (skipping `node_modules` / caches). Docker and `supabase` CLI: **absent**.

| Variable | Process env | `server/.env` |
|---|---|---|
| `SUPABASE_URL` | missing | missing |
| `SUPABASE_ANON_KEY` | missing | missing |
| `SUPABASE_SERVICE_ROLE_KEY` | missing | missing |
| `DATABASE_URL` | missing | present — **local** `127.0.0.1:5432` postgres URI |
| `DIRECT_URL` | missing | present — **same local** postgres URI |

`server/.env` keys (names only): `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`, `ORDER_RESERVATION_MINUTES`. No `SUPABASE_*`.

`config.supabaseConfigured` remains **`false`**. Express is still on the local database.

---

## What was **not** done (on purpose)

- Did **not** change `DATABASE_URL` / `DIRECT_URL` to a non-existent Supabase project
- Did **not** run `prisma migrate reset` or any destructive SQL
- Did **not** seed fake Auth users
- Did **not** claim GoTrue login works
- Did **not** start Stripe, Admin, Vercel, Railway, or deploy
- Did **not** modify `styles.css` or the SPA

---

## Current connection status

| Item | Status |
|---|---|
| Database | Local PostgreSQL `nexora` — `GET /api/health` → `{ status: "ok", database: "connected" }` |
| Prisma migrations | Previously applied, including `20260907120000_supabase_auth_prep`. **Not re-applied against Supabase** (no target) |
| Supabase Auth | **Not connected** |
| Existing-user bridge vs GoTrue | **Not exercised live** |
| Frontend | `styles.css?v=15`, `app.js?v=18`, no supabase client, no service-role strings |

---

## Existing-data note (local DB only)

Verified on local Postgres this prompt: 64 products, required tables present, decimal prices intact. That is **not** a Supabase data verification.

---

## `#/dashboard` test assertion (item 10)

The earlier 59/60 failure was a **stale test expectation**, not a UI bug.

- `index.html` has `data-view="dashboard"` and `id="view-dashboard"`
- There is **no** `href="#/dashboard"` in the HTML
- The hash is set in `app.js` (`location.hash = "#/dashboard"`)

Production UI was **not** changed. The suite now asserts the real markup (`data-view` / `id`), not a missing `href`.

---

## Local regression this prompt (not live Supabase)

`node server/scripts/regression.js` against `http://127.0.0.1:3000` after an API restart (in-memory `checkoutLimiter` 8/15m had been exhausted by earlier runs on the same process; limiter code was **not** raised).

**58 passed / 58 executed / 0 failed.** `supabaseConfigured: false`.

Covered: UI lock (`styles.css?v=15`, `app.js?v=18`, no supabase in HTML, no service-role in frontend, no `onerror=`), schema + 64 products, register/login/`nexora_sid`/cart merge, logout isolation, expired session, concurrent last-unit 201+409, reservation expiry, two-product pending + stock unchanged, atomic 409 rollback, `confirmPaidOrder` idempotent, price snapshot, owner/other/guest order GET, no public pay, OOS merge drop, origin 403, invalid JSON, CSP, 413/414.

A first run on the old process was **51/57** — six checkout assertions 429’d because the limiter was already at max. That is the limiter working, not a product bug. After restart: **58/58**.

Live GoTrue / live pooler tests: **0** (blocked).

---

## Test count against live Supabase

| | |
|---|---|
| Total executed against live Supabase | **0** |
| Passed | 0 |
| Failed | 0 |
| Skipped | all live Auth/DB cutover tests — **blocked** |

---

## Exact missing configuration

To proceed with a real cutover, set **server-side only**:

1. `SUPABASE_URL` — `https://<project>.supabase.co`
2. `SUPABASE_ANON_KEY` — anon public key (keep server-side in this architecture)
3. `SUPABASE_SERVICE_ROLE_KEY` — **never** ship to the browser
4. `DATABASE_URL` — Supabase **pooler** URI (typically port 6543, `?pgbouncer=true`)
5. `DIRECT_URL` — Supabase **direct** URI (port 5432) for `prisma migrate deploy`

Then, and only then: `npx prisma migrate deploy` (never reset), restart Express, run the live suite (auth, bridge, cart, reservations, security).

---

## Files changed this prompt

- `server/scripts/regression.js` — dashboard assertion uses `data-view` / `id` (test only)
- `NEXORA-PHASE7-SUPABASE-LIVE-REPORT.md` (this file)

No application code, schema, or UI files were modified.

Stopped. No Stripe, Admin, or deploy.
