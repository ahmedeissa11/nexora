"use strict";

/**
 * Phase 15 database / migration / data-safety checks.
 * Never prints secret values. Never mutates the durable nexora catalog except throwaway rows that are deleted.
 * Isolated database is created, exercised, and dropped in this process.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");
const { Prisma, PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const { toCents } = require("../src/services/paymentService");
const catalog = require("../src/services/adminCatalogService");

const ROOT = "/home/user";
const SERVER = path.join(ROOT, "server");
const MIG_DIR = path.join(SERVER, "prisma", "migrations");
const TEMP_DB = "nexora_p15_fresh";
const prisma = new PrismaClient();
const results = [];

function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: cond ? "ok" : String(detail == null ? "" : detail).slice(0, 300) });
  console.log(cond ? "PASS" : "FAIL", name, cond ? "" : String(detail == null ? "" : detail).slice(0, 300));
}

function withDbName(url, name) {
  const s = String(url || "");
  const hash = s.indexOf("#");
  const noHash = hash === -1 ? s : s.slice(0, hash);
  const q = noHash.indexOf("?");
  const base = q === -1 ? noHash : noHash.slice(0, q);
  const qs = q === -1 ? "" : noHash.slice(q);
  const slash = base.lastIndexOf("/");
  if (slash === -1) throw new Error("invalid database url");
  return base.slice(0, slash + 1) + name + qs;
}

function psqlAdmin(sql) {
  const r = spawnSync(
    "sudo",
    ["-n", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-d", "postgres", "-c", sql],
    {
      encoding: "utf8",
      env: { PATH: process.env.PATH, HOME: process.env.HOME || "/home/user" },
    }
  );
  return r;
}

function spawnNode(args, extraEnv) {
  return spawnSync(process.execPath, args, {
    cwd: SERVER,
    encoding: "utf8",
    env: Object.assign({}, process.env, extraEnv || {}),
  });
}

function inventoryMigrations() {
  const dirs = fs
    .readdirSync(MIG_DIR)
    .filter((d) => fs.statSync(path.join(MIG_DIR, d)).isDirectory())
    .sort();
  const reports = [];
  for (const d of dirs) {
    const sql = fs.readFileSync(path.join(MIG_DIR, d, "migration.sql"), "utf8");
    reports.push({
      name: d,
      dropTable: /\bDROP\s+TABLE\b/i.test(sql),
      truncate: /\bTRUNCATE\b/i.test(sql),
      dropColumn: /\bDROP\s+COLUMN\b/i.test(sql),
      dropDatabase: /\bDROP\s+DATABASE\b/i.test(sql),
      sql,
    });
  }
  return reports;
}

async function cleanupThrowaways() {
  const emails = ["p15-safety@nexora.test", "p15-wl@nexora.test", "p15-role@nexora.test"];
  await prisma.stripeEvent.deleteMany({ where: { id: { startsWith: "evt_p15_" } } });
  const orders = await prisma.order.findMany({ where: { OR: [{ id: { startsWith: "NX-P15" } }, { email: { in: emails } }] }, select: { id: true } });
  const oids = orders.map((o) => o.id);
  if (oids.length) {
    await prisma.inventoryReservation.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
  }
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const uids = users.map((u) => u.id);
  if (uids.length) {
    await prisma.wishlist.deleteMany({ where: { userId: { in: uids } } });
    await prisma.session.deleteMany({ where: { userId: { in: uids } } });
    await prisma.cart.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }
  await prisma.inventoryAdjustment.deleteMany({ where: { productId: { startsWith: "p15-" } } });
  await prisma.productSpec.deleteMany({ where: { productId: { startsWith: "p15-" } } });
  await prisma.review.deleteMany({ where: { productId: { startsWith: "p15-" } } });
  await prisma.dropItem.deleteMany({ where: { productId: { startsWith: "p15-" } } });
  await prisma.wishlist.deleteMany({ where: { productId: { startsWith: "p15-" } } });
  await prisma.product.deleteMany({ where: { id: { startsWith: "p15-" } } });
}

async function createThrowawayProduct(id) {
  return prisma.product.create({
    data: {
      id,
      name: "P15 Safety",
      slug: id,
      category: "Accessories",
      collection: "Studio",
      type: "object",
      price: new Prisma.Decimal("10.00"),
      image: "images/p15.jpg",
      meta: "safety",
      blurb: "Throwaway row for Phase 15 FK tests.",
      stock: 4,
      isActive: true,
    },
  });
}

if (process.env.NEXORA_DB_SAFETY_CHILD === "boot") {
  (async () => {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    const health = await fetch(base + "/api/health");
    const live = await fetch(base + "/api/live");
    const products = await fetch(base + "/api/products?page=1");
    const hj = await health.json();
    const pj = await products.json();
    const count = Array.isArray(pj.products) ? pj.products.length : 0;
    console.log(
      JSON.stringify({
        health: health.status,
        healthOk: hj.status === "ok",
        live: live.status,
        products: products.status,
        pageSize: count,
      })
    );
    await new Promise((resolve) => server.close(resolve));
    process.exit(health.status === 200 && live.status === 200 && products.status === 200 ? 0 : 1);
  })().catch(() => process.exit(1));
} else {
  (async () => {
    const catalogCount = await prisma.product.count();
    try {
      check("styles.css locked", fs.statSync(path.join(ROOT, "styles.css")).size === 40333);
      const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
      check("app.js?v=19", html.includes("app.js?v=19"));
      check("styles.css?v=15", html.includes("styles.css?v=15"));

      const migs = inventoryMigrations();
      check("ten forward migrations", migs.length === 10, migs.map((m) => m.name).join(","));
      check(
        "migrations chronological",
        migs.map((m) => m.name).join("|") ===
          [
            "20260830142304_init",
            "20260830144327_sessions",
            "20260830145309_orders_seq",
            "20260830145320_order_number_seq",
            "20260830163000_inventory_reservations",
            "20260907120000_supabase_auth_prep",
            "20260907140000_stripe_payments",
            "20260907160000_admin_rbac",
            "20260907180000_admin_catalog",
            "20260908120000_data_safety_constraints",
          ].join("|"),
        migs.map((m) => m.name).join(",")
      );
      check(
        "no DROP TABLE / TRUNCATE / DROP DATABASE in migrations",
        migs.every((m) => !m.dropTable && !m.truncate && !m.dropDatabase)
      );
      check("no DROP COLUMN in migrations", migs.every((m) => !m.dropColumn));
      const latest = migs[migs.length - 1];
      check("latest is forward safety migration", latest && latest.name === "20260908120000_data_safety_constraints");
      check("safety migration adds reservation unique", /InventoryReservation_orderId_productId_key/.test(latest.sql));
      check("safety migration adds stock CHECK", /Product_stock_nonnegative/.test(latest.sql));
      check("safety migration Restricts wishlist product FK", /Wishlist_productId_fkey/.test(latest.sql) && /ON DELETE RESTRICT/.test(latest.sql));

      const schema = fs.readFileSync(path.join(SERVER, "prisma", "schema.prisma"), "utf8");
      check("money Decimal(10, 2)", (schema.match(/@db\.Decimal\(10, 2\)/g) || []).length >= 6);
      check("OrderItem product Restrict", /model OrderItem[\s\S]*onDelete: Restrict/.test(schema));
      check("CartItem product Restrict", /model CartItem[\s\S]*onDelete: Restrict/.test(schema));
      check("Reservation product Restrict", /model InventoryReservation[\s\S]*onDelete: Restrict/.test(schema));
      check("Adjustment product Restrict", /model InventoryAdjustment[\s\S]*onDelete: Restrict/.test(schema));
      check("Wishlist product Restrict", /model Wishlist[\s\S]*onDelete: Restrict/.test(schema));
      check("User delete SetNull on Order", /model Order[\s\S]*onDelete: SetNull/.test(schema));
      const stripeBlock = (schema.match(/model StripeEvent \{[\s\S]*?\n\}/) || [""])[0];
      check("StripeEvent has no Order relation", /model StripeEvent/.test(stripeBlock) && !/Order\s+@relation/.test(stripeBlock));
      check("Product isActive default true", /isActive\s+Boolean\s+@default\(true\)/.test(schema));
      check("reservation unique order+product", /@@unique\(\[orderId, productId\]\)/.test(schema));

      const pkg = JSON.parse(fs.readFileSync(path.join(SERVER, "package.json"), "utf8"));
      check("start is node src/index.js", pkg.scripts.start === "node src/index.js");
      check("prisma:deploy is migrate deploy", pkg.scripts["prisma:deploy"] === "prisma migrate deploy");
      check("no migrate reset script", !JSON.stringify(pkg.scripts).includes("migrate reset"));
      check("no db push script", !JSON.stringify(pkg.scripts).includes("db push"));
      check("db:setup refuses production", /refuse-production/.test(pkg.scripts["db:setup"]));

      const seedSrc = fs.readFileSync(path.join(SERVER, "prisma", "seed.js"), "utf8");
      const assertIdx = seedSrc.indexOf("assertSeedAllowed");
      const delIdx = seedSrc.indexOf("product.deleteMany");
      check("seed asserts before deleteMany", assertIdx !== -1 && delIdx !== -1 && assertIdx < delIdx);
      check("seed has no TRUNCATE", !/\bTRUNCATE\b/.test(seedSrc));

      const integSrc = fs.readFileSync(path.join(SERVER, "prisma", "..", "scripts", "data-integrity-check.js"), "utf8");
      check("integrity never writes", !/\.(create|update|delete|updateMany|deleteMany|createMany)\(/.test(integSrc));

      const gen = spawnSync("npx", ["prisma", "generate"], { cwd: SERVER, encoding: "utf8", env: process.env });
      check("prisma generate", gen.status === 0, (gen.stderr || gen.stdout || "").slice(-200));

      const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], { cwd: SERVER, encoding: "utf8", env: process.env });
      const deployOut = String(deploy.stdout || "") + String(deploy.stderr || "");
      check("migrate deploy on existing data", deploy.status === 0, deployOut.slice(-240));
      check("existing catalog count unchanged by migrate", (await prisma.product.count()) === catalogCount, catalogCount);
      const legacy = await prisma.order.findUnique({ where: { id: "NX-1842" } });
      check("legacy placed NX-1842 survives migrate", Boolean(legacy) && legacy.status === "placed");

      check("toCents 111.11", toCents("111.11") === 11111);
      check("toCents 19.99", toCents(new Prisma.Decimal("19.99")) === 1999);
      check("toCents 10.00", toCents("10.00") === 1000);
      check("toCents 0.30", toCents("0.30") === 30);
      check("toCents shipping 0", toCents("0.00") === 0);
      let centsThrew = false;
      try {
        toCents("1.234");
      } catch (_err) {
        centsThrew = true;
      }
      check("toCents rejects extra fractional cents", centsThrew);
      const sum = new Prisma.Decimal("111.11").mul(1).add(new Prisma.Decimal("0.00"));
      check("Decimal line total 111.11", sum.equals("111.11") && toCents(sum) === 11111);

      await cleanupThrowaways();
      await createThrowawayProduct("p15-fk");
      await prisma.order.create({
        data: {
          id: "NX-P15FK",
          email: "p15-safety@nexora.test",
          firstName: "P15",
          lastName: "Safety",
          address: "1 Audit Row",
          status: "paid",
          paidAt: new Date(Date.now() + 5000),
          subtotal: new Prisma.Decimal("10.00"),
          shipping: new Prisma.Decimal("0.00"),
          total: new Prisma.Decimal("10.00"),
          currency: "usd",
          items: {
            create: {
              productId: "p15-fk",
              name: "P15 Safety",
              image: "images/p15.jpg",
              finish: "graphite",
              qty: 1,
              unitPrice: new Prisma.Decimal("10.00"),
            },
          },
        },
      });
      let deleteBlocked = false;
      try {
        await prisma.product.delete({ where: { id: "p15-fk" } });
      } catch (err) {
        deleteBlocked = Boolean(err && (err.code === "P2003" || err.code === "P2014" || /Foreign key|restrict/i.test(String(err.message))));
      }
      check("product hard-delete blocked by OrderItem Restrict", deleteBlocked);
      const archived = await catalog.archiveProduct("p15-fk", null);
      check("archive sets isActive false", archived && archived.isActive === false);
      const itemAfter = await prisma.orderItem.findFirst({ where: { orderId: "NX-P15FK" } });
      check(
        "historical OrderItem survives archive",
        Boolean(itemAfter) && Number(itemAfter.unitPrice) === 10
      );
      const stillPaid = await prisma.order.findUnique({ where: { id: "NX-P15FK" } });
      check("historical order survives archive", stillPaid && stillPaid.status === "paid");

      const app = createApp();
      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const BASE = "http://127.0.0.1:" + server.address().port;
      try {
        const hidden = await fetch(BASE + "/api/products/p15-fk");
        check("customer PDP 404 for archived product", hidden.status === 404, hidden.status);
        const list = await fetch(BASE + "/api/products?page=1&perPage=50");
        const listJson = await list.json();
        const ids = (listJson.products || []).map((p) => p.id);
        check("archived product absent from catalog", !ids.includes("p15-fk"));
        const ping = await fetch(BASE + "/api/health");
        const pingJson = await ping.json();
        check("health ok after safety migration", ping.status === 200 && pingJson.status === "ok");
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }

      let negStock = false;
      try {
        await prisma.product.update({ where: { id: "p15-fk" }, data: { stock: -1 } });
      } catch (_err) {
        negStock = true;
      }
      check("CHECK rejects negative stock", negStock);
      const stockStill = await prisma.product.findUnique({ where: { id: "p15-fk" } });
      check("negative stock not persisted", stockStill && stockStill.stock === 4);

      let badRole = false;
      try {
        await prisma.user.create({
          data: { email: "p15-role@nexora.test", passwordHash: "x", role: "superadmin" },
        });
      } catch (_err) {
        badRole = true;
      }
      check("CHECK rejects invalid role", badRole);

      const wlUser = await prisma.user.create({
        data: { email: "p15-wl@nexora.test", passwordHash: "x", role: "customer" },
      });
      await prisma.wishlist.create({ data: { userId: wlUser.id, productId: "p15-fk" } });
      await prisma.orderItem.deleteMany({ where: { orderId: "NX-P15FK" } });
      await prisma.order.delete({ where: { id: "NX-P15FK" } });
      let wishBlocked = false;
      try {
        await prisma.product.delete({ where: { id: "p15-fk" } });
      } catch (err) {
        wishBlocked = Boolean(err && (err.code === "P2003" || err.code === "P2014"));
      }
      check("product hard-delete blocked by Wishlist Restrict", wishBlocked);

      await prisma.order.create({
        data: {
          id: "NX-P15RES",
          email: "p15-safety@nexora.test",
          firstName: "P15",
          lastName: "Safety",
          address: "1 Audit Row",
          status: "pending_payment",
          subtotal: new Prisma.Decimal("10.00"),
          total: new Prisma.Decimal("10.00"),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      await prisma.inventoryReservation.create({
        data: {
          orderId: "NX-P15RES",
          productId: "p15-fk",
          qty: 1,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          status: "active",
        },
      });
      let dupRes = false;
      try {
        await prisma.inventoryReservation.create({
          data: {
            orderId: "NX-P15RES",
            productId: "p15-fk",
            qty: 1,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            status: "active",
          },
        });
      } catch (err) {
        dupRes = Boolean(err && err.code === "P2002");
      }
      check("unique (orderId, productId) on reservations", dupRes);

      await prisma.stripeEvent.create({ data: { id: "evt_p15_dup", type: "checkout.session.completed", orderId: "NX-P15RES" } });
      let dupEvt = false;
      try {
        await prisma.stripeEvent.create({ data: { id: "evt_p15_dup", type: "checkout.session.completed" } });
      } catch (err) {
        dupEvt = Boolean(err && err.code === "P2002");
      }
      check("StripeEvent id unique", dupEvt);

      const prodSeed = spawnNode(["prisma/seed.js"], { NODE_ENV: "production" });
      const prodOut = String(prodSeed.stderr || "") + String(prodSeed.stdout || "");
      check("seed refuses NODE_ENV=production", prodSeed.status !== 0 && /Refusing to seed: NODE_ENV=production/.test(prodOut));
      check("production seed output has no secret dump", !/postgresql:\/\/[^:]+:[^@]+@/i.test(prodOut));

      const liveSeed = spawnNode(["prisma/seed.js"], { NODE_ENV: "development" });
      const liveOut = String(liveSeed.stderr || "") + String(liveSeed.stdout || "");
      check("seed refuses existing transactional data", liveSeed.status !== 0 && /transactional rows exist/.test(liveOut));

      const refuseProd = spawnNode(["scripts/refuse-production.js"], { NODE_ENV: "production" });
      check("refuse-production exits 1", refuseProd.status !== 0);
      const refuseDev = spawnNode(["scripts/refuse-production.js"], { NODE_ENV: "development" });
      check("refuse-production allows development", refuseDev.status === 0);

      const invSrc = fs.readFileSync(path.join(SERVER, "src", "services", "inventoryService.js"), "utf8");
      const paySrc = fs.readFileSync(path.join(SERVER, "src", "services", "paymentService.js"), "utf8");
      check("inventory has no result cache", !/lru|node-cache|ttl cache|cachedAvailable/i.test(invSrc));
      check("payment has no result cache", !/lru|node-cache|ttl cache/i.test(paySrc));
      check("inventory locks rows FOR UPDATE", /FOR UPDATE/.test(invSrc) || /lockProducts/.test(invSrc));

      await cleanupThrowaways();
      check("throwaway rows removed", (await prisma.product.count({ where: { id: { startsWith: "p15-" } } })) === 0);
      check("durable catalog still 64", (await prisma.product.count()) === 64, await prisma.product.count());
      check("legacy placed still present", Boolean(await prisma.order.findUnique({ where: { id: "NX-1842" } })));

      function dropTempDb() {
        psqlAdmin(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '" +
            TEMP_DB +
            "' AND pid <> pg_backend_pid();"
        );
        return psqlAdmin("DROP DATABASE IF EXISTS " + TEMP_DB + ";");
      }
      dropTempDb();
      const created = psqlAdmin("CREATE DATABASE " + TEMP_DB + " OWNER nexora;");
      check("isolated database created", created.status === 0, (created.stderr || created.stdout || "").slice(-200));
      if (created.status === 0) {
        const freshUrl = withDbName(process.env.DATABASE_URL, TEMP_DB);
        const migFresh = spawnSync("npx", ["prisma", "migrate", "deploy"], {
          cwd: SERVER,
          encoding: "utf8",
          env: Object.assign({}, process.env, { DATABASE_URL: freshUrl, DIRECT_URL: freshUrl }),
        });
        const migFreshOut = String(migFresh.stdout || "") + String(migFresh.stderr || "");
        check("isolated migrate deploy", migFresh.status === 0, migFreshOut.slice(-240));
        const seedFresh = spawnSync(process.execPath, ["prisma/seed.js"], {
          cwd: SERVER,
          encoding: "utf8",
          env: Object.assign({}, process.env, {
            DATABASE_URL: freshUrl,
            DIRECT_URL: freshUrl,
            NODE_ENV: "development",
          }),
        });
        const seedFreshOut = String(seedFresh.stdout || "") + String(seedFresh.stderr || "");
        check("isolated seed succeeds on empty DB", seedFresh.status === 0 && /Seeded 64 products/.test(seedFreshOut), seedFreshOut.slice(-240));
        const integFresh = spawnSync(process.execPath, ["scripts/data-integrity-check.js"], {
          cwd: SERVER,
          encoding: "utf8",
          env: Object.assign({}, process.env, { DATABASE_URL: freshUrl, DIRECT_URL: freshUrl }),
        });
        check("isolated integrity OK", integFresh.status === 0, String(integFresh.stdout || "").slice(-240));
        const boot = spawnSync(process.execPath, ["scripts/db-safety-regression.js"], {
          cwd: SERVER,
          encoding: "utf8",
          env: Object.assign({}, process.env, {
            DATABASE_URL: freshUrl,
            DIRECT_URL: freshUrl,
            NEXORA_DB_SAFETY_CHILD: "boot",
          }),
        });
        let bootJson = {};
        try {
          bootJson = JSON.parse(String(boot.stdout || "").trim().split("\n").pop());
        } catch (_err) {
          bootJson = {};
        }
        check(
          "isolated boot health/live/products",
          boot.status === 0 && bootJson.health === 200 && bootJson.live === 200 && bootJson.products === 200,
          String(boot.stdout || boot.stderr || "").slice(-240)
        );
        const dropped = dropTempDb();
        check("isolated database dropped", dropped.status === 0, (dropped.stderr || dropped.stdout || "").slice(-160));
      }

      const durableAfter = await prisma.product.count();
      check("durable nexora untouched by isolated DB", durableAfter === 64, durableAfter);
      check("durable NX-1842 untouched", Boolean(await prisma.order.findUnique({ where: { id: "NX-1842" } })));

      const integrity = spawnSync(process.execPath, ["scripts/data-integrity-check.js"], {
        cwd: SERVER,
        encoding: "utf8",
        env: process.env,
      });
      check("integrity on durable DB exit 0", integrity.status === 0, String(integrity.stdout || "").slice(-240));
      check("integrity reports 17 checks", /"checks":17/.test(String(integrity.stdout || "")), String(integrity.stdout || "").slice(-200));
    } finally {
      try {
        await cleanupThrowaways();
      } catch (_err) {
        /* ignore */
      }
      await prisma.$disconnect();
    }

    const fails = results.filter((r) => !r.ok);
    console.log("\n==== DB SAFETY SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
    console.log(
      JSON.stringify({
        total: results.length,
        passed: results.length - fails.length,
        failed: fails.length,
        fails: fails.map((f) => f.name + ": " + f.detail),
      })
    );
    process.exit(fails.length ? 1 : 0);
  })().catch((err) => {
    const msg = String((err && err.message) || err || "")
      .replace(/postgresql:\/\/[^\s]+/gi, "postgresql://redacted")
      .slice(0, 400);
    console.error("db-safety failed", err && err.code, msg);
    process.exit(1);
  });
}
