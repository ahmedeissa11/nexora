# NEXORA — Phase 7 report
Supabase PostgreSQL + Supabase Auth (code complete; cloud credentials still required)

## A. Architecture before

Browser → Vanilla JS SPA → Express API → Prisma 5 → local PostgreSQL  
Auth: bcrypt `User.passwordHash` + Express HttpOnly `nexora_sid` (HMAC in `Session`)

## B. Architecture after

```
Browser (Vanilla JS, unchanged)
   ↓  same-origin /api  (no Supabase client, no JWT in localStorage)
Express
   ├── Prisma  →  PostgreSQL (DATABASE_URL; DIRECT_URL for migrations)
   └── Supabase Auth (when SUPABASE_* is set)
         ↓
      identity only
         ↓
      Express still issues HttpOnly nexora_sid
      Express still owns cart / orders / inventory
```

Production (`NODE_ENV=production`) **refuses to boot** without Supabase Auth keys.  
This sandbox has no Supabase project, so development still accepts local bcrypt so the working demo is not killed. That path is a temporary bridge, not a second production identity.

Chosen session model: **A** — Express-managed HttpOnly `nexora_sid`, identity proven by Supabase Auth (or local bcrypt until keys exist). JWTs from GoTrue are discarded server-side and never sent to the browser.

## C. Files changed

- `server/prisma/schema.prisma` — `directUrl`, `User.authId`, `User.passwordHash` nullable
- `server/prisma/migrations/20260907120000_supabase_auth_prep/migration.sql`
- `server/src/config/index.js`
- `server/src/services/supabase.js` (new, server-only)
- `server/src/services/authService.js`
- `server/package.json` / lockfile — `@supabase/supabase-js`
- `server/.env.example`
- `server/.env` — `DIRECT_URL` only (no secrets added)

**Not changed:** `styles.css`, `app.js`, `index.html`, `api.js`, checkout/dashboard UI, Stripe, Admin.

## D. Migrations created

`20260907120000_supabase_auth_prep`  
Additive only: `User.authId` unique nullable; `passwordHash` DROP NOT NULL. No drops, no reset, no ID rewrites.

## E. Database migration status

Applied on the current PostgreSQL (`nexora`). Products, orders, reservations, carts intact. Historical `placed` not rewritten.

Prisma is kept. `DATABASE_URL` + `DIRECT_URL` are ready for Supabase pooling (6543 + `pgbouncer=true`) vs direct (5432).

## F. Auth migration strategy

- Application `User.id` (cuid) stays the FK for Cart / Order / Wishlist. **Not replaced with auth.users UUID.**
- `User.authId` stores Supabase `auth.users.id`.
- Passwords are **not** copied. There is no plaintext.
- **Existing bcrypt users:** on next successful Continue/login, password is verified locally, a Supabase user is created with that live password, `authId` is stored, `passwordHash` is set **null**.
- **New users (Supabase configured):** `admin.createUser` + app row, never a hash in `User`.
- Empty user table in this sandbox: nothing to backfill.

## G. Session / cookie architecture

Unchanged cookie pattern:

- `nexora_sid` HttpOnly, SameSite=Lax, Path=/, Secure in production, 14 days, HMAC at rest
- `cart_token` same flags, HMAC `v1:` at rest
- Logout deletes the Express session row and clears the cookie
- Guest → user merge still runs in `establish()` after login/register

One API identity: `req.user` from `nexora_sid`. Supabase JWT is not a second session.

## H. API changes

None of the public paths changed:

`/api/health` `/api/products` `/api/products/:id` `/api/search` `/api/home` `/api/articles` `/api/cart` `/api/auth/register` `/api/auth/login` `/api/auth/logout` `/api/me` `/api/orders` `/api/orders/:id`

Continue still: login, else register. Generic `Invalid email or password`.  
`confirmPaidOrder` / `cancelOrder` still internal. No pay endpoint.

## I. Environment variables required

```
DATABASE_URL                  # Postgres (local or Supabase pooler)
DIRECT_URL                    # Postgres direct (migrations)
SESSION_SECRET                # cookie + cart HMAC
PORT
NODE_ENV
ORDER_RESERVATION_MINUTES
SUPABASE_URL                  # required in production
SUPABASE_ANON_KEY             # server-side password grant; not shipped to JS
SUPABASE_SERVICE_ROLE_KEY     # server-only admin createUser
```

Service role must never reach the browser. Anon key is kept server-side as well (not required on the SPA).

## J. Data preservation

No reset. Catalog 64, schema additive. `placed` orders untouched.

## K. Authentication tests (local bridge)

| Test | Result |
|---|---|
| Register 201 + HttpOnly session | PASS |
| Duplicate register generic 401 | PASS |
| Wrong password generic 401 | PASS |
| `/api/me` 200 + no-store | PASS |
| Logout → `/api/me` 401 | PASS |
| Login restores user | PASS |
| User JSON has no password fields | PASS |

**Not run:** live GoTrue sign-in (no project keys in this environment).

## L. Cart tests

Guest add → register merge → `cart_token` cleared → logout isolation → login restores user cart. PASS.

## M. Order / reservation tests

Concurrent last unit 201+409; stock not decremented; `pending_payment`; expiry releases; authenticated order; owner GET; other user 401/404; `confirmPaidOrder` idempotent; no public pay. PASS.

## N. Security regression

Origin 403, invalid JSON 400, 413, 414, API 404 JSON, CSP `script-src 'self'`, no-store, page cap, `qty: null` 400, no supabase strings in HTML. PASS.

## O. Frontend regression

`styles.css?v=15`, `app.js?v=18` unchanged. Account modal still Email + Password + Continue. No frontend supabase client.

## P. Bugs found and fixed

None in this cutover. Prisma `directUrl` requires `DIRECT_URL` even locally — set equal to `DATABASE_URL`.

## Q. Remaining blockers

**Cannot finish a live Supabase cutover without a project.** This environment has no Docker (so no `supabase start`) and no cloud credentials. Inventing a project would be fabricating identities.

Until keys are set:

- Development login uses the local bcrypt bridge (so the demo keeps working)
- Production boot is designed to fail closed without Supabase

## R. Exact external actions still required

In the Supabase dashboard (or CLI on a machine with Docker):

1. Create a project.
2. Copy **Project URL**, **anon public** key, **service_role** key.
3. Copy **URI** (direct 5432) and **pooled** URI (6543).
4. Put them in Railway/server `.env` as `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pooled + `pgbouncer=true`), `DIRECT_URL` (direct).
5. Run `npx prisma migrate deploy` against that database (same migration history; do **not** reset).
6. Optionally dump/restore the current `nexora` database into Supabase Postgres if you want this catalog/orders there.
7. Confirm Authentication → Providers → Email enabled; disable “Confirm email” or keep `email_confirm: true` on admin create (already used so users can sign in without SMTP).

Then restart Express. New Continue flows hit GoTrue; bcrypt hashes null out on first successful login.

---

No Stripe. No Admin. No deploy. UI locked. Stopped after Phase 7 code.
