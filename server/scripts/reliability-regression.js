"use strict";

/**
 * Phase 14 reliability checks. Never prints secret values.
 * Uses an isolated HTTP server. Does not disconnect the shared Prisma pool used by other suites.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const { shutdown } = require("../src/lifecycle");
const runtime = require("../src/runtime");
const { errorHandler } = require("../src/middleware/error");
const { canTransition } = require("../src/services/orderState");
const orderService = require("../src/services/orderService");
const inventory = require("../src/services/inventoryService");
const { redact } = require("../src/utils/log");

const prisma = new PrismaClient();
const results = [];

function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: cond ? "ok" : String(detail == null ? "" : detail) });
  console.log(cond ? "PASS" : "FAIL", name, cond ? "" : detail);
}

(async () => {
  runtime.setDraining(false);
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const BASE = "http://127.0.0.1:" + server.address().port;
  const snapshot = await prisma.product.findMany({ select: { id: true, stock: true } });
  const restore = async () => {
    for (const p of snapshot) {
      await prisma.product.update({ where: { id: p.id }, data: { stock: p.stock } });
    }
  };

  try {
    check("styles.css locked", fs.statSync("/home/user/styles.css").size === 40333);
    const html = fs.readFileSync("/home/user/index.html", "utf8");
    check("app.js?v=19", html.includes("app.js?v=19"));
    check("styles.css?v=15", html.includes("styles.css?v=15"));

    const live = await fetch(BASE + "/api/live");
    const liveJson = await live.json();
    check("liveness ok", live.status === 200 && liveJson.status === "ok");
    const rid = live.headers.get("x-request-id");
    check("request id header", Boolean(rid) && /^[A-Za-z0-9._-]{8,128}$/.test(rid), rid);

    const echoed = await fetch(BASE + "/api/live", { headers: { "X-Request-Id": "rel-test-12345" } });
    check("request id echo", echoed.headers.get("x-request-id") === "rel-test-12345");

    const junk = await fetch(BASE + "/api/live", { headers: { "X-Request-Id": "bad id with spaces" } });
    check("junk request id replaced", junk.headers.get("x-request-id") !== "bad id with spaces");

    const ready = await fetch(BASE + "/api/ready");
    const readyJson = await ready.json();
    check("readiness ok", ready.status === 200 && readyJson.status === "ok" && readyJson.database === "connected");
    check("readiness metrics present (non-prod)", readyJson.metrics && typeof readyJson.metrics.requests === "number");

    const health = await fetch(BASE + "/api/health");
    const healthJson = await health.json();
    check("health ok", health.status === 200 && healthJson.status === "ok");
    check("health no secrets", !/postgres|sk_|whsec_|service.role/i.test(JSON.stringify(healthJson)));

    runtime.setDraining(true);
    const readyDown = await fetch(BASE + "/api/ready");
    const liveDown = await fetch(BASE + "/api/live");
    const healthDown = await fetch(BASE + "/api/health");
    const whDown = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=ab" },
      body: "{}",
    });
    check("ready 503 when draining", readyDown.status === 503);
    check("live 200 when draining", liveDown.status === 200);
    check("health 503 when draining", healthDown.status === 503);
    check("webhook 503 when draining", whDown.status === 503);
    runtime.setDraining(false);

    check("pending_payment -> paid allowed", canTransition("pending_payment", "paid"));
    check("pending_payment -> cancelled allowed", canTransition("pending_payment", "cancelled"));
    check("pending_payment -> expired allowed", canTransition("pending_payment", "expired"));
    check("paid -> dispatched allowed", canTransition("paid", "dispatched"));
    check("expired -> paid forbidden", canTransition("expired", "paid") === false);
    check("cancelled -> paid forbidden", canTransition("cancelled", "paid") === false);
    check("dispatched -> paid forbidden", canTransition("dispatched", "paid") === false);
    check("placed -> paid forbidden", canTransition("placed", "paid") === false);
    check("placed -> dispatched forbidden", canTransition("placed", "dispatched") === false);

    const placedRows = await prisma.order.findMany({ where: { status: "placed" }, take: 1 });
    if (placedRows[0]) {
      try {
        await orderService.confirmPaidOrder(placedRows[0].id);
        check("legacy placed cannot pay", false, "paid");
      } catch (err) {
        check("legacy placed cannot pay", err && err.status === 409, err && err.message);
      }
      try {
        await orderService.dispatchOrder(placedRows[0].id);
        check("legacy placed cannot dispatch", false, "dispatched");
      } catch (err) {
        check("legacy placed cannot dispatch", err && err.status === 409, err && err.message);
      }
    } else {
      check("legacy placed cannot pay", true, "no placed fixture");
      check("legacy placed cannot dispatch", true, "no placed fixture");
    }

    await prisma.inventoryReservation.updateMany({
      where: { productId: "halo", status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 3 } });
    const jarHeaders = { "Content-Type": "application/json", Accept: "application/json" };
    const addHalo = await fetch(BASE + "/api/cart", {
      method: "POST",
      headers: jarHeaders,
      body: JSON.stringify({ id: "halo", qty: 1, finish: "graphite" }),
    });
    const cartCookie = (addHalo.headers.getSetCookie && addHalo.headers.getSetCookie()[0]) || addHalo.headers.get("set-cookie") || "";
    const cookie = String(cartCookie).split(";")[0];
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 0 } });
    const failOrder = await fetch(BASE + "/api/orders", {
      method: "POST",
      headers: { ...jarHeaders, Cookie: cookie },
      body: JSON.stringify({
        first: "Ada",
        last: "Lovelace",
        email: "rel-rollback@nexora.test",
        address: "12 Quiet Lane, Lisbon",
      }),
    });
    check("transaction rollback 409", failOrder.status === 409, failOrder.status);
    const leftover = await prisma.order.count({ where: { email: "rel-rollback@nexora.test" } });
    check("no partial order after rollback", leftover === 0, leftover);
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 3 } });

    const expAdd = await fetch(BASE + "/api/cart", {
      method: "POST",
      headers: jarHeaders,
      body: JSON.stringify({ id: "halo", qty: 1, finish: "midnight" }),
    });
    const expCookie = String((expAdd.headers.getSetCookie && expAdd.headers.getSetCookie()[0]) || expAdd.headers.get("set-cookie") || "").split(";")[0];
    const expOrder = await fetch(BASE + "/api/orders", {
      method: "POST",
      headers: { ...jarHeaders, Cookie: expCookie },
      body: JSON.stringify({
        first: "Ada",
        last: "Lovelace",
        email: "rel-exp@nexora.test",
        address: "12 Quiet Lane, Lisbon",
      }),
    });
    const expJson = await expOrder.json();
    check("expire fixture pending", expOrder.status === 201, expOrder.status);
    if (expJson.orderId) {
      const past = new Date(Date.now() - 1000);
      await prisma.inventoryReservation.updateMany({ where: { orderId: expJson.orderId }, data: { expiresAt: past } });
      await prisma.order.update({ where: { id: expJson.orderId }, data: { expiresAt: past } });
      await inventory.expireOverdueReservations();
      const after = await prisma.order.findUnique({
        where: { id: expJson.orderId },
        include: { reservations: true },
      });
      check("reservation expiration", after.status === "expired", after.status);
      check(
        "expired reservations not active",
        after.reservations.every((r) => r.status === "expired"),
        after.reservations.map((r) => r.status).join(",")
      );
      try {
        await orderService.confirmPaidOrder(expJson.orderId);
        check("expired cannot pay", false, "paid");
      } catch (err) {
        check("expired cannot pay", err && err.status === 409, err && err.message);
      }
    }

    const before = (await prisma.product.findUnique({ where: { id: "vessel" } })).stock;
    const catalog = require("../src/services/adminCatalogService");
    const [a1, a2] = await Promise.all([
      catalog.adjustInventory("vessel", { delta: 2, reason: "rel-conc-a" }, null),
      catalog.adjustInventory("vessel", { delta: 2, reason: "rel-conc-b" }, null),
    ]);
    const afterStock = (await prisma.product.findUnique({ where: { id: "vessel" } })).stock;
    check("admin inventory concurrency both apply", afterStock === before + 4, afterStock + " vs " + (before + 4));
    check("adjustments not replayed", a1.replayed === false && a2.replayed === false);

    const key = "rel-idem-" + Date.now();
    const first = await catalog.adjustInventory("vessel", { delta: 1, reason: "rel-idem", idempotencyKey: key }, null);
    const second = await catalog.adjustInventory("vessel", { delta: 1, reason: "rel-idem", idempotencyKey: key }, null);
    check("inventory idempotency replay", first.replayed === false && second.replayed === true);
    const afterIdem = (await prisma.product.findUnique({ where: { id: "vessel" } })).stock;
    check("idempotent adjust once", afterIdem === afterStock + 1, String(afterIdem));

    let body = null;
    const res = {
      headersSent: false,
      statusCode: 0,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        body = payload;
        return this;
      },
    };
    const boom = new Error("SELECT * FROM \"User\" WHERE password='secret' postgresql://u:p@localhost/db at /home/user/server/src/x.js");
    boom.stack = "/home/user/server/src/x.js:9:1";
    errorHandler(boom, { originalUrl: "/api/orders", requestId: "rel-err" }, res, () => {});
    check("500 sanitized", res.statusCode === 500 && body && body.error === "Internal server error");
    check(
      "500 has no sql/path/secret",
      !/SELECT|postgresql:\/\/|password='secret'|\/home\/user\/server/i.test(JSON.stringify(body))
    );

    const redacted = redact("postgresql://u:p@db.example/nexora Bearer abc sk_live_ABC123 whsec_HELLO");
    check("log redact db url", !/postgresql:\/\/u:p/.test(redacted) && /redacted/.test(redacted));
    check("log redact stripe", !/sk_live_ABC123/.test(redacted) && !/whsec_HELLO/.test(redacted));

    const cfg = spawnSync(
      process.execPath,
      ["-e", "require('./src/config')"],
      {
        cwd: path.join("/home/user", "server"),
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "production",
          PORT: "8080",
          DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/nexora",
          SESSION_SECRET: "x".repeat(40),
        },
        encoding: "utf8",
      }
    );
    const cfgOut = String(cfg.stderr || "") + String(cfg.stdout || "");
    check("prod boot names missing supabase", cfg.status !== 0 && /SUPABASE_URL/.test(cfgOut));
    check("prod boot does not dump db url userinfo", !/postgresql:\/\/u:p/.test(cfgOut));

    const missingSecret = spawnSync(process.execPath, ["-e", "require('./src/config')"], {
      cwd: path.join("/home/user", "server"),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "development",
        SESSION_SECRET: "",
        DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/nexora",
      },
      encoding: "utf8",
    });
    const missOut = String(missingSecret.stderr || "") + String(missingSecret.stdout || "");
    check(
      "missing SESSION_SECRET names the var",
      missingSecret.status !== 0 && /SESSION_SECRET/.test(missOut) && !/x{40}/.test(missOut)
    );

    const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css", "admin.js", "admin.css", "config.js"]
      .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
      .join("\n");
    check(
      "secret scan frontend",
      !/sk_live_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s\"']+/.test(front)
    );

    const integrity = spawnSync(process.execPath, ["scripts/data-integrity-check.js"], {
      cwd: path.join("/home/user", "server"),
      encoding: "utf8",
      env: process.env,
    });
    check("data integrity check exit 0", integrity.status === 0, (integrity.stdout || "").slice(-200));

    const stopApp = createApp();
    const stopServer = http.createServer(stopApp);
    await new Promise((resolve) => stopServer.listen(0, "127.0.0.1", resolve));
    const stopPort = stopServer.address().port;
    const up = await fetch("http://127.0.0.1:" + stopPort + "/api/live");
    check("shutdown target live", up.status === 200);
    await shutdown({ server: stopServer, stopSweeper: () => {} }, { signal: "test", disconnectPrisma: false, timeoutMs: 4000 });
    let down = false;
    try {
      await fetch("http://127.0.0.1:" + stopPort + "/api/live");
    } catch (_err) {
      down = true;
    }
    check("graceful shutdown closes server", down);
    runtime.setDraining(false);

    const neg = await prisma.product.count({ where: { stock: { lt: 0 } } });
    check("no negative stock", neg === 0);
  } finally {
    runtime.setDraining(false);
    try {
      await restore();
    } catch (_err) {
      /* ignore */
    }
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== RELIABILITY SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
  console.log(
    JSON.stringify({
      total: results.length,
      passed: results.length - fails.length,
      failed: fails.length,
      fails: fails.map((f) => f.name + ": " + f.detail),
    })
  );
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error("reliability failed");
  process.exit(1);
});
