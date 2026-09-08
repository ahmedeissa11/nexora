"use strict";

/**
 * Phase 12 cutover detector. Never prints secret values.
 * Live GoTrue/pooler tests run only when real credentials are present.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { config, looksLikeSupabaseUrl, classifyDatabaseKind } = require("../src/config");

const prisma = new PrismaClient();
const results = [];

function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: cond ? "ok" : String(detail == null ? "" : detail) });
  console.log(cond ? "PASS" : "FAIL", name, cond ? "" : detail);
}

function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

(async () => {
  const live = {
    attempted: false,
    connected: false,
    auth: false,
    reason: "",
  };

  try {
    check("DATABASE_URL set", present("DATABASE_URL") || Boolean(config.databaseUrl));
    check("DIRECT_URL set", present("DIRECT_URL") || Boolean(config.directUrl));
    check("SESSION_SECRET set", present("SESSION_SECRET") || Boolean(config.sessionSecret));
    check("databaseKind classified", ["local", "supabase", "other"].includes(config.databaseKind), config.databaseKind);
    check("supabaseConfigured boolean", typeof config.supabaseConfigured === "boolean");
    check(
      "placeholder URL is not live",
      !looksLikeSupabaseUrl("https://YOUR_PROJECT.supabase.co")
    );
    check(
      "local URL is not supabase kind",
      classifyDatabaseKind("postgresql://u:p@127.0.0.1:5432/nexora") === "local"
    );
    check(
      "pooler URL is supabase kind",
      classifyDatabaseKind("postgresql://u:p@aws-0-us.pooler.supabase.com:6543/postgres") === "supabase"
    );

    await prisma.$queryRaw`SELECT 1`;
    check("local/current Prisma ping", true);

    const tables = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`;
    const names = tables.map((t) => t.tablename);
    const required = [
      "User",
      "Session",
      "Product",
      "ProductSpec",
      "Finish",
      "Cart",
      "CartItem",
      "Wishlist",
      "Order",
      "OrderItem",
      "InventoryReservation",
      "InventoryAdjustment",
      "Review",
      "Article",
      "Subscriber",
      "Drop",
      "DropItem",
      "AuditLog",
      "AdminBootstrapState",
      "StripeEvent",
    ];
    check("required tables", required.every((n) => names.includes(n)), names.join(","));

    const products = await prisma.product.count();
    const neg = await prisma.product.count({ where: { stock: { lt: 0 } } });
    const inactive = await prisma.product.count({ where: { isActive: false } });
    const placed = await prisma.order.count({ where: { status: "placed" } });
    const users = await prisma.user.count();
    const withHash = await prisma.user.count({ where: { passwordHash: { not: null } } });
    const withAuthId = await prisma.user.count({ where: { authId: { not: null } } });
    check("product count 64", products === 64, products);
    check("no negative stock", neg === 0);
    check("placed orders preserved", placed >= 1, placed);

    const frontFiles = ["app.js", "api.js", "index.html", "catalog.js", "styles.css", "admin.js", "admin.css", "config.js"];
    const front = frontFiles
      .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
      .join("\n");
    check(
      "no secrets in frontend",
      !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|ADMIN_BOOTSTRAP_SECRET|SERVICE_ROLE|sk_live_|whsec_|DATABASE_URL|SESSION_SECRET|SUPABASE_SERVICE_ROLE/i.test(
        front
      )
    );
    check("styles.css locked", fs.statSync("/home/user/styles.css").size === 40333);
    check("no supabase-js in frontend", !/supabase-js|createClient\(/.test(front));
    check("auth uses Express session", /nexora_sid/.test(fs.readFileSync("/home/user/server/src/services/sessionService.js", "utf8")));

    const canLive =
      config.supabaseConfigured &&
      config.databaseKind === "supabase" &&
      looksLikeSupabaseUrl(config.supabaseUrl);

    if (!canLive) {
      live.reason =
        "SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY and a Supabase DATABASE_URL are not present. Credentials were not invented.";
      check("live supabase skipped (no credentials)", true, live.reason);
    } else {
      live.attempted = true;
      try {
        const healthUrl = config.supabaseUrl.replace(/\/$/, "") + "/auth/v1/health";
        const res = await fetch(healthUrl, {
          headers: { apikey: config.supabaseAnonKey, Authorization: "Bearer " + config.supabaseAnonKey },
        });
        live.auth = res.ok;
        check("live GoTrue health", res.ok, res.status);
      } catch (err) {
        check("live GoTrue health", false, err && err.message ? "network error" : "failed");
      }
      try {
        await prisma.$queryRaw`SELECT 1`;
        live.connected = true;
        check("live Prisma ping", true);
      } catch (_err) {
        check("live Prisma ping", false, "failed");
      }
    }

    const summary = {
      liveSupabaseAttempted: live.attempted,
      liveSupabaseDb: live.connected,
      liveSupabaseAuth: live.auth,
      liveSkipReason: live.attempted ? "" : live.reason,
      databaseKind: config.databaseKind,
      supabaseConfigured: config.supabaseConfigured,
      products,
      inactive,
      negativeStock: neg,
      placedOrders: placed,
      users,
      usersWithPasswordHash: withHash,
      usersWithAuthId: withAuthId,
    };
    console.log("\n==== CUTOVER CHECK " + (results.filter((r) => r.ok).length) + "/" + results.length + " ====");
    console.log(JSON.stringify(summary));
  } finally {
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error("cutover-check failed");
  process.exit(1);
});
