"use strict";

/**
 * Phase 13 production readiness. Never prints secret values.
 * Fails closed: missing live credentials => READY false.
 */
const fs = require("fs");
const path = require("path");
const { config, looksLikeSecret, looksLikeSupabaseUrl, classifyDatabaseKind } = require("../src/config");

const ROOT = "/home/user";
const results = [];

function check(group, name, cond, detail) {
  results.push({ group, name, ok: !!cond, detail: cond ? "ok" : String(detail == null ? "" : detail) });
  console.log(cond ? "PASS" : "FAIL", "[" + group + "]", name, cond ? "" : detail);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const SECRET_RE =
  /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|ADMIN_BOOTSTRAP_SECRET|SUPABASE_SERVICE_ROLE|sk_live_|sk_test_|whsec_|eyJhbGci|SESSION_SECRET\s*[:=]\s*["'][^"']+|DATABASE_URL\s*[:=]\s*["']postgres/i;

(function run() {
  const indexJs = read("server/src/index.js") + (exists("server/src/lifecycle.js") ? read("server/src/lifecycle.js") : "");
  const appJs = read("server/src/app.js");
  const cfgJs = read("server/src/config/index.js");
  const secJs = read("server/src/middleware/security.js");
  const sessJs = read("server/src/services/sessionService.js");
  const cookJs = read("server/src/utils/cookies.js");
  const healthJs = read("server/src/controllers/healthController.js");
  const payJs = read("server/src/services/paymentService.js");
  const stripeJs = read("server/src/services/stripeService.js");
  const schema = read("server/prisma/schema.prisma");
  const pkg = read("server/package.json");
  const envEx = read("server/.env.example");
  const railway = exists("server/railway.toml") ? read("server/railway.toml") : "";
  const nix = exists("server/nixpacks.toml") ? read("server/nixpacks.toml") : "";
  const proc = exists("server/Procfile") ? read("server/Procfile") : "";
  const vercel = exists("vercel.json") ? read("vercel.json") : "";
  const gitignore = exists(".gitignore") ? read(".gitignore") : "";
  const sgitignore = read("server/.gitignore");
  const apiJs = read("api.js");
  const confJs = read("config.js");
  const html = read("index.html");
  const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css", "admin.js", "admin.css", "config.js"]
    .map(read)
    .join("\n");

  check("struct", "listen uses PORT / 0.0.0.0", /listen\(config\.port,\s*"0\.0\.0\.0"/.test(indexJs));
  check("struct", "SIGTERM shutdown", /SIGTERM/.test(indexJs) && /server\.close/.test(indexJs));
  check("struct", "health controller exists", /status:\s*"ok"/.test(healthJs));
  check("struct", "prod health has no extra secrets", !/supabaseUrl|stripeSecret|databaseUrl/.test(healthJs));
  check("struct", "no wildcard CORS in security", !/Access-Control-Allow-Origin["'`\s]*\*|: "\*"/.test(secJs) && !/\*/.test(secJs.match(/Allow-Origin.*/)?.[0] || ""));
  check("struct", "CORS never star", !/Allow-Origin",\s*"\*"/.test(secJs) && secJs.includes("Access-Control-Allow-Origin") && secJs.includes("Allow-Credentials"));
  check("struct", "origin guard still 403", /status\(403\)/.test(secJs) && /originGuard/.test(secJs));
  check("struct", "cookie httpOnly", /httpOnly:\s*true/.test(cookJs) || /httpOnly:\s*true/.test(sessJs));
  check("struct", "cookie SameSite default lax", /cookieSameSite/.test(cfgJs) && /lax/.test(cfgJs));
  check("struct", "cookie Secure in prod", /secure:/.test(cookJs));
  check("struct", "no CORS star in repo config", !/Access-Control-Allow-Origin:\s*\*/.test(front + appJs + secJs));
  check("struct", "static serving is gated", /serveStatic/.test(appJs) && /SERVE_STATIC/.test(cfgJs));
  check("struct", "Stripe webhook raw body", /express\.raw/.test(appJs) && /webhooks\/stripe/.test(appJs));
  check("struct", "constructEvent used", /constructEvent/.test(stripeJs));
  check("struct", "PUBLIC_ORIGIN used for Stripe return", /config\.publicOrigin/.test(payJs));
  check("struct", "Prisma User.authId", /authId/.test(schema));
  check("struct", "Prisma User.role", /role\s+String/.test(schema));
  check("struct", "Prisma reservation indexes", /@@index\(\[status, expiresAt\]\)/.test(schema) || /@@index\(\[expiresAt\]\)/.test(schema));
  check("struct", "Prisma binaryTargets debian", /debian-openssl-3\.0\.x/.test(schema));
  check("struct", "directUrl in schema", /directUrl/.test(schema));
  check("struct", "no migrate reset in package scripts", !/migrate reset/.test(pkg));
  check("struct", "prisma deploy script", /prisma migrate deploy/.test(pkg));
  check("struct", "railway.toml start", /node src\/index\.js/.test(railway));
  check("struct", "railway healthcheck /api/health", /healthcheckPath = "\/api\/health"/.test(railway));
  check("struct", "railway migrate deploy not reset", /migrate deploy/.test(railway) && !/migrate reset/.test(railway + nix + proc));
  check("struct", "nixpacks no local pg", !/pg_ctlcluster|postgresql/.test(nix));
  check("struct", "Procfile web", /node src\/index\.js/.test(proc));
  check("struct", "vercel.json static not backend", vercel.includes("write-frontend-config") && !/src\/index\.js/.test(vercel));
  check("struct", "vercel CSP no connect-src star", /connect-src 'self'/.test(vercel) && !/connect-src \*/.test(vercel));
  check("struct", "gitignore .env", gitignore.includes(".env") && sgitignore.includes(".env"));
  check("struct", "gitignore does not ignore .env.example", /!\.env\.example/.test(gitignore) || /!\.env\.example/.test(sgitignore));
  check("struct", "frontend configurable API base", /NEXORA_API_BASE/.test(apiJs) && /NEXORA_API_BASE/.test(confJs));
  check("struct", "config.js default same-origin", /NEXORA_API_BASE = ""/.test(confJs) || /NEXORA_API_BASE = ''/.test(confJs));
  check("struct", "index loads config.js", html.includes("config.js") && html.includes("app.js?v=19") && html.includes("styles.css?v=15"));
  check("struct", "styles.css locked", fs.statSync(path.join(ROOT, "styles.css")).size === 40333);
  check("struct", "no secrets in frontend", !SECRET_RE.test(front));
  check("struct", "no supabase-js in frontend", !/supabase-js|createClient\(/.test(front));
  check("struct", "no localhost API hardcoded", !/http:\/\/localhost:3000/.test(apiJs + confJs + html));
  check("struct", ".env.example has pooled notes", /6543/.test(envEx) && /sslmode=require/.test(envEx) && /migrate reset/.test(envEx));
  check("struct", "prod refuses placeholder supabase", /supabaseConfigured/.test(cfgJs) && /databaseKind/.test(cfgJs));
  check("struct", "prod refuses STRIPE_MOCK", /STRIPE_MOCK is not allowed/.test(cfgJs));
  check("struct", "ALLOWED_ORIGINS rejects star", /must not contain wildcards/.test(cfgJs));
  check("struct", "trust proxy", /trust proxy/.test(appJs));
  check("struct", "x-powered-by disabled", /disable\("x-powered-by"\)/.test(appJs));
  check("struct", "Helmet CSP script-src self", /scriptSrc: \["'self'"\]/.test(appJs));
  check("struct", "no Express session JWT in localStorage pattern", !/localStorage[\s\S]{0,60}(jwt|access_token|supabase)/i.test(front));

  const deployFiles = railway + nix + proc + pkg + read("server/package.json");
  check("struct", "no destructive db commands in deploy files", !/migrate reset|db push --force-reset|DROP DATABASE/i.test(deployFiles));
  const seedJs = read("server/prisma/seed.js");
  const integJs = read("server/scripts/data-integrity-check.js");
  const startCmd = JSON.parse(pkg).scripts.start || "";
  check("struct", "seed refuses production", /Refusing to seed: NODE_ENV=production/.test(seedJs));
  check("struct", "seed refuses transactional rows", /transactional rows exist/.test(seedJs));
  check("struct", "start has no migrate or seed", !/migrate|seed/.test(startCmd));
  check(
    "struct",
    "integrity is read-only",
    /READ-ONLY/.test(integJs) && !/\.(create|update|delete|updateMany|deleteMany|createMany)\(/.test(integJs)
  );

  check(
    "env",
    "hosted postgres",
    config.databaseKind === "supabase" || config.databaseKind === "neon",
    config.databaseKind
  );
  check(
    "env",
    "supabaseConfigured or neon",
    config.databaseKind === "neon" || config.supabaseConfigured,
    "not configured (credentials absent; not invented)"
  );
  check("env", "DATABASE_URL not localhost", config.databaseKind !== "local" && config.databaseKind !== "missing", config.databaseKind);
  check("env", "looksLikeSupabaseUrl", looksLikeSupabaseUrl(config.supabaseUrl), "absent");
  check("env", "SESSION_SECRET strong", looksLikeSecret(config.sessionSecret), "weak or placeholder");
  check("env", "stripe configured without mock", Boolean(config.stripeSecretKey && config.stripeWebhookSecret) && !config.stripeMock, config.stripeMock ? "mock" : "missing keys");
  check("env", "STRIPE_SECRET looks real", looksLikeSecret(config.stripeSecretKey), "absent");
  check("env", "STRIPE_WEBHOOK_SECRET looks real", looksLikeSecret(config.stripeWebhookSecret), "absent");
  check("env", "PUBLIC_ORIGIN set", Boolean(config.publicOrigin), "missing");
  check("env", "NODE_ENV production", config.isProd, config.env);
  check("env", "serveStatic off for API host", config.isProd ? config.serveStatic === false : true, "dev default on");
  check("env", "no CROSS_SITE without allowlist", !(config.crossSiteCookies && config.allowedOrigins.length === 0));

  const struct = results.filter((r) => r.group === "struct");
  const env = results.filter((r) => r.group === "env");
  const structFail = struct.filter((r) => !r.ok);
  const envFail = env.filter((r) => !r.ok);
  const ready = structFail.length === 0 && envFail.length === 0;

  const summary = {
    ready,
    structural: struct.filter((r) => r.ok).length + "/" + struct.length,
    env: env.filter((r) => r.ok).length + "/" + env.length,
    liveSupabase: false,
    liveStripe: false,
    liveDeploy: false,
    databaseKind: config.databaseKind,
    supabaseConfigured: config.supabaseConfigured,
    stripeMock: config.stripeMock,
    envBlockers: envFail.map((f) => f.name),
    structuralBlockers: structFail.map((f) => f.name),
  };
  console.log("\n==== PROD READY " + (ready ? "YES" : "NO") + " ====");
  console.log(JSON.stringify(summary));
  process.exit(ready ? 0 : 1);
})();
