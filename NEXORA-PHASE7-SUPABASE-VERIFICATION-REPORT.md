# NEXORA — Phase 7 verification (prompt 2/30)

**Verdict:** the Supabase-ready foundation is in the Express/Prisma code and was regression-tested against the **current local PostgreSQL**. A **live** Supabase Database + Auth cutover was **not** executed. Credentials are absent; they were not invented.

## What was actually connected

| Target | Connected? |
|---|---|
| Local PostgreSQL `nexora` @ 127.0.0.1:5432 | **Yes** — Express + Prisma |
| Supabase pooler `DATABASE_URL` | **No** — env has local URL only |
| Supabase direct `DIRECT_URL` | **No** — set equal to local URL for Prisma |
| Supabase Auth (GoTrue) | **No** — `SUPABASE_URL` / `ANON` / `SERVICE_ROLE` are unset |

`config.supabaseConfigured === false`. Production still refuses to boot without those three keys. Development keeps the bcrypt bridge so the working demo is not killed.

This sandbox has **no Docker**, so `supabase start` is not available either.

## Database migration result

Already applied (not re-reset):

- `20260830142304_init`
- `20260830144327_sessions`
- `20260830145309_orders_seq` / `20260830145320_order_number_seq`
- `20260830163000_inventory_reservations`
- `20260907120000_supabase_auth_prep` (`User.authId`, `passwordHash` nullable)

Verified now:

- Required tables present: User, Session, Product, ProductSpec, Finish, Cart, CartItem, Order, OrderItem, InventoryReservation, Article, Subscriber, Drop, DropItem, Wishlist
- **64 products** remain
- Decimal prices intact
- Order rows remain (`expired`, `paid` from prior tests). No `placed` rows in this restored DB — none were invented or converted
- InventoryReservation rows remain
- **No** `migrate reset`, drop, or truncate

Prisma is still the data layer. Pointing `DATABASE_URL` + `DIRECT_URL` at Supabase Postgres is a configuration change, not a rewrite.

## Supabase Auth result

**Not live.** Code path exists (`authService` → `admin.createUser` / `signInWithPassword`) and is used **only** when all three keys are set.

Browser still talks only to Express. No supabase-js in `app.js` / `api.js` / `index.html`. Service-role key cannot be read from frontend source.

## Existing-user bridge result

**Logic present, not exercised against GoTrue** (no project).

Designed behavior (unchanged except a linking guard this prompt):

- App `User.id` (cuid) stays the FK for cart/orders/wishlist
- `User.authId` = Supabase `auth.users.id`
- On bcrypt-only login (`passwordHash` set, `authId` null): verify hash with the password just typed → `createUser` (or sign-in if the email already exists **and** that password works) → store `authId` → **null `passwordHash`**
- Refuse to attach a Supabase user id that already belongs to a different app user
- Generic `Invalid email or password` on all public failures

Passwords are not fabricated. Identities are not fabricated.

Until keys exist, new local registers still write `passwordHash`. That is the documented development bridge, not a production identity.

## Session result

Executed against Express `nexora_sid`:

- HttpOnly cookie issued on register/login
- `GET /api/me` 200 + `Cache-Control: no-store, private`
- Logout → `/api/me` 401
- Session row forced expired → `/api/me` 401
- Re-login restores the same user
- No JWT written to localStorage by this stack

## Cart regression result

- Guest add
- Same product + same finish quantities combine (1+2 → 3)
- Same product + different finishes stay two lines
- Guest → register merge
- `cart_token` cleared after auth
- Logout isolation (next guest cart empty)
- Re-login restores the authenticated cart
- Other user does not see that cart
- OOS guest line dropped on merge

## Order / reservation regression result

- Concurrent last unit: one `201 pending_payment`, one `409`; **physical stock still 1**
- Expiry sweeper: reservation + order → `expired`
- Two products: two `active` reservations, stock unchanged
- One SKU zeroed after cart add: **409**, no order, no partial reservation
- `confirmPaidOrder` twice: paid once, second `alreadyPaid`
- Price snapshot held `111.11` after catalog moved to `999.99`
- Owner GET 200; other user 401/404; guest 401
- `POST /api/orders/:id/pay` → 404
- No public mark-paid

## Security regression result

Origin 403 · invalid JSON 400 · 413 · 414 · API `{ error: "Not found" }` · CSP `script-src 'self'` · no-store · page cap · `qty: null` 400 · no `onerror=` in `app.js` · no supabase/service-role in frontend.

Auth limiter (20/15m) was **not** hammered.

## Exact test count

**59 passed / 60 executed.**

The single failure was a **test assertion** looking for the literal `#/dashboard` in `index.html`. The dashboard view is `data-view="dashboard"` and is opened from JS (`#/dashboard`); the UI file was not missing. Not a product bug.

Live GoTrue tests: **0** (blocked).

## Remaining blockers

Unavoidable external action — **create or supply a real Supabase project** and set, server-side only:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL          # pooler, port 6543, ?pgbouncer=true
DIRECT_URL            # direct 5432, for prisma migrate deploy
```

Then:

1. `npx prisma migrate deploy` on that database (**never reset**)
2. Optional: dump/restore this `nexora` database if the catalog should live there
3. Restart Express
4. Email provider enabled; admin create already uses `email_confirm: true`

Do **not** put `SUPABASE_SERVICE_ROLE_KEY` in the SPA.

Until that happens, claiming “Supabase Auth is authoritative in this environment” would be false.

## Files changed this prompt

- `server/src/services/authService.js` — refuse mismatched/duplicate `authId` linking
- `NEXORA-PHASE7-SUPABASE-VERIFICATION-REPORT.md` — this file

## UI / design

**Unchanged.** `styles.css?v=15`, `app.js?v=18`, checkout, overlays, cards, nav, dashboard markup — not edited.

No Stripe. No Admin. No Vercel/Railway/deploy.
