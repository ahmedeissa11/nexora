# NEXORA Phase 18 — Live deployment

**Status: NOT LIVE — waiting on Arena connection UI.**  
Re-checked after you chose “connect all five”: still no GitHub / Vercel / Railway / Supabase / Stripe session in this sandbox. Credentials were not invented. Phase 19 not started.

This sandbox has **no authenticated GitHub, Vercel, Railway, Supabase, or Stripe access**. Network to those APIs works; account ownership does not. Structural deploy files already exist. Local product is intact. `production-readiness-check` remains **READY false**, as required when live services are absent.

UI lock held: `styles.css` **40333**, `styles.css?v=15`, `app.js?v=19`. No redesign.

---

## Deployment status

| Target | Status |
|---|---|
| GitHub repository | **Not created** — no git repo, no `gh`, no SSH, no git credentials |
| Vercel frontend | **Not deployed** — `npx vercel whoami` → no credentials (`vercel login` / `--token`) |
| Railway backend | **Not deployed** — `npx @railway/cli whoami` → Unauthorized |
| Supabase PostgreSQL | **Not connected** — `npx supabase projects list` → no access token |
| Stripe Checkout + webhooks | **Not configured** — no Stripe CLI, no `STRIPE_*` env |
| Production URL | **None** |
| API URL | **None** (local preview only: `0.0.0.0:3000`) |
| Custom domain | **None** — nothing to attach |

Discovered in this environment (names only): `E2B_*`, `HOME`, `PATH`, `USER`. No `VERCEL_TOKEN`, `RAILWAY_TOKEN`, `SUPABASE_*`, `STRIPE_*`, `GITHUB_TOKEN`, `GH_TOKEN`, `DATABASE_URL` in the process environment. Local `server/.env` is **localhost Postgres** (development). It was not copied, printed, or promoted.

Attempted autonomously:

- Inspected git, CLIs, env, SSH, `.gitignore`, `vercel.json`, `server/railway.toml`, `nixpacks.toml`, Procfile
- Installed/ran via npx: Vercel CLI 39.4.2, Railway CLI, Supabase CLI 2.117.0
- Confirmed GitHub.com / Vercel / Railway APIs are reachable over HTTPS
- Did **not** run `prisma migrate deploy` against any remote database
- Did **not** hardcode a Railway URL, invent keys, or commit `.env`

---

## What is already wired (no live accounts required)

These files are ready for a real deploy **once you authorize the accounts**:

- Frontend: `vercel.json` (static SPA, `write-frontend-config.js`, CSP `connect-src 'self'`, empty `rewrites` until a Railway host exists)
- `NEXORA_API_BASE` / `config.js` — empty means same-origin `/api` (intended Vercel rewrite)
- Backend: `server/railway.toml` — `node src/index.js`, healthcheck `/api/health`, **releaseCommand** `npx prisma migrate deploy` (not reset / not `db push`)
- `server/nixpacks.toml` + Procfile
- Production boot **fails closed** without real Supabase URL + keys, Supabase `DATABASE_URL`, strong `SESSION_SECRET`, real Stripe secret + webhook secret, and `PUBLIC_ORIGIN` https
- `.gitignore` excludes `.env`, keys, `.vercel`, `.railway`

Intended path (unchanged):

```
Browser → Vercel SPA → /api rewrite → Railway Express → Supabase Postgres
                                         ↘ Stripe Checkout + webhook
```

---

## Environment configuration (no secret values)

| Variable | Where | Now |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Railway (server) | Local only |
| `SESSION_SECRET` | Railway | Local only |
| `NODE_ENV` | Railway | `development` locally |
| `PORT` | Railway | Bound `0.0.0.0` via existing listen |
| `PUBLIC_ORIGIN` | Railway | Missing |
| `ALLOWED_ORIGINS` | Railway | Missing |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Railway **only** | Absent |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Railway **only** | Absent |
| `NEXORA_API_BASE` | Vercel **build** (public, not a secret) | Empty → same-origin `/api` |

Never put Stripe, session, or service-role keys in Vercel frontend env or `config.js`.

---

## Database migration status

- Local `nexora` PG 17: connected, **64** products, `NX-1842` `placed` preserved
- Production Supabase: **not applied** (no project)
- No `migrate reset`, no `db push`, no production seed, no truncate

---

## Health / smoke (live production)

**Not run** — there is no public production host.

Local preview only: `/api/health` → `200` `database: connected`, `databaseKind: local`, `supabaseAuth: not_configured`.

---

## Regression results (this machine, 2026-09-08)

| Suite | Result |
|---|---|
| product-completion | **49/49** |
| customer regression | **59/59** |
| Stripe regression | **56/56** (`liveStripe: false`) |
| admin regression | **59/59** |
| admin API regression | **89/89** |
| admin UI regression | **45/45** |
| Supabase cutover | **18/18** (live skipped; credentials not invented) |
| reliability | **48/48** |
| integrity | **17/17** read-only |
| database safety | **74/74** |
| production-readiness | **READY false** — structural **51/51**; env **3/12** |

Env blockers (expected): `supabaseConfigured`, `databaseKind supabase`, `DATABASE_URL not localhost`, `looksLikeSupabaseUrl`, `stripe configured without mock`, `STRIPE_SECRET looks real`, `STRIPE_WEBHOOK_SECRET looks real`, `PUBLIC_ORIGIN set`, `NODE_ENV production`.

---

## Remaining blockers (external — Arena cannot obtain these)

Arena cannot create paid/cloud accounts, complete OAuth logins, or invent keys. No tokens were present to reuse.

### Minimum action required from you

One authorization pack. **Do not paste secrets into chat if your policy forbids it** — a Vercel/Railway/GitHub token in the environment, or CLI login in this workspace, is enough. After that, this agent can finish deploy without you editing source.

1. **GitHub**  
   - Create (or name) a repo, e.g. `nexora`.  
   - Provide a PAT with `repo` (and `delete_repo` not required) **or** run `gh auth login` / add an SSH deploy key in this workspace.

2. **Vercel**  
   - Account with permission to create a project.  
   - `VERCEL_TOKEN` **or** `vercel login`.

3. **Railway**  
   - Account with permission to create a service.  
   - `RAILWAY_TOKEN` **or** `railway login`.

4. **Supabase (production Postgres + Auth)**  
   - A project (new is fine).  
   - Pooled `DATABASE_URL` (port **6543**, `pgbouncer=true`, `sslmode=require`).  
   - Direct `DIRECT_URL` (port **5432**, `sslmode=require`).  
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.  
   - Do not send the service role to the browser.

5. **Stripe**  
   - Test mode is enough for first live verification.  
   - `STRIPE_SECRET_KEY`, then after Railway URL exists: webhook to `https://<railway-host>/api/webhooks/stripe` for `checkout.session.completed` (and existing handlers), and `STRIPE_WEBHOOK_SECRET`.  
   - No mark-paid / public `/pay`.

No domain purchase. Provider URLs (`.vercel.app` / Railway host) are enough.

---

## What I will do immediately after you authorize

1. `git init` (if needed), verify `.gitignore`, commit **without** `.env`, push to GitHub.  
2. Create Railway service from `server/`, set production env (never in git), `prisma migrate deploy` only.  
3. Confirm `https://<railway>/api/live`, `/api/ready`, `/api/health`.  
4. Create Vercel project for the SPA, set rewrite `/api/:path*` → Railway `/api/:path*`, keep `NEXORA_API_BASE` empty (same-origin).  
5. Set Railway `PUBLIC_ORIGIN` to the Vercel https origin; register Stripe webhook; never fake payment.  
6. Live smoke: Home → Shop → Product → Cart → Account → Checkout (Stripe test) → order history; plus search/wishlist/compare/journal/admin gate.  
7. Re-run this suite and `prod:check` until **READY true**.

---

## Final production readiness

**READY false. Not deployed. Not live.**

Structural deploy config is complete. Live launch is blocked only by **account authorization** for GitHub, Vercel, Railway, Supabase, and Stripe — none of which exist in this sandbox.
