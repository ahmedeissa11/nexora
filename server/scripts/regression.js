"use strict";

/**
 * NEXORA regression suite — hits the running Express server.
 * Does not print secrets. Does not require live Supabase.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const orderService = require("../src/services/orderService");
const inventory = require("../src/services/inventoryService");
const sessionService = require("../src/services/sessionService");
const { config } = require("../src/config");

const BASE = process.env.NEXORA_BASE || "http://127.0.0.1:3000";
const prisma = new PrismaClient();
const results = [];

function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail: cond ? "ok" : String(detail == null ? "" : detail) });
  console.log(cond ? "PASS" : "FAIL", name, cond ? "" : detail);
}

function parseCookies(res, bag) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const fallback = res.headers.get("set-cookie");
  const list = raw && raw.length ? raw : fallback ? [fallback] : [];
  for (const line of list) {
    const part = String(line).split(";")[0];
    const eq = part.indexOf("=");
    if (eq < 1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (v === "") delete bag[k];
    else bag[k] = v;
  }
}

class Jar {
  constructor() {
    this.cookies = {};
  }
  async call(method, pathName, body, extraHeaders) {
    const headers = Object.assign({ Accept: "application/json" }, extraHeaders || {});
    const cookie = Object.entries(this.cookies)
      .map(([k, v]) => k + "=" + v)
      .join("; ");
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(BASE + pathName, { method, headers, body: payload });
    parseCookies(res, this.cookies);
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text.slice(0, 300);
    }
    return { status: res.status, json, headers: res.headers };
  }
}

function checkoutBody(tag) {
  return {
    first: "Ada",
    last: "Lovelace",
    email: tag + "@nexora.test",
    address: "12 Quiet Lane, Lisbon",
  };
}

(async () => {
  const html = await (await fetch(BASE + "/")).text();

  check("styles.css?v=15 locked", html.includes("styles.css?v=15"));
  check("app.js?v=19", html.includes("app.js?v=19"));
  check("no supabase in HTML", !/supabase/i.test(html));
  const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css"]
    .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
    .join("\n");
  check("no service-role in frontend", !/SERVICE_ROLE|supabaseServiceRole/i.test(front));
  check(
    "no stripe secrets in frontend",
    !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|sk_test_|whsec_/i.test(front)
  );
  check("no onerror= in app.js", !fs.readFileSync("/home/user/app.js", "utf8").includes("onerror="));
  check(
    "dashboard view exists (hash is JS, not href)",
    html.includes('data-view="dashboard"') && html.includes('id="view-dashboard"')
  );
  check("shop hash route in html", html.includes("#/shop"));
  check("account + checkout forms", html.includes('id="account-form"') && html.includes('id="checkout-form"'));

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
    "Order",
    "OrderItem",
    "InventoryReservation",
    "Article",
    "Subscriber",
    "Drop",
    "DropItem",
    "Wishlist",
  ];
  check("required tables", required.every((n) => names.includes(n)), names.join(","));
  check("product count 64", (await prisma.product.count()) === 64, await prisma.product.count());
  const decimal = await prisma.product.findFirst({ where: { id: "type" }, select: { price: true } });
  check("decimal price", decimal && Number(decimal.price) > 0, JSON.stringify(decimal));

  const email = "reg-" + Date.now() + "@nexora.test";
  const password = "password1";
  const u = new Jar();
  await u.call("POST", "/api/cart", { id: "vessel", qty: 1, finish: "graphite" });
  await u.call("POST", "/api/cart", { id: "vessel", qty: 1, finish: "midnight" });
  const reg = await u.call("POST", "/api/auth/register", { email, password });
  check("register 201", reg.status === 201, JSON.stringify(reg.json));
  check("nexora_sid issued", Boolean(u.cookies.nexora_sid));
  check("cart_token cleared", !u.cookies.cart_token);
  const merged = await u.call("GET", "/api/cart");
  const vesselLines = ((merged.json && merged.json.items) || []).filter((i) => i.product.id === "vessel");
  check("two finishes separate", vesselLines.length === 2, vesselLines.map((i) => i.finish + ":" + i.qty).join(","));
  const me = await u.call("GET", "/api/me");
  check("me 200", me.status === 200 && me.json.user.email === email, JSON.stringify(me.json));
  check("me no-store", (me.headers.get("cache-control") || "").includes("no-store"));
  check("me has no password", !("passwordHash" in (me.json.user || {})));

  const g = new Jar();
  await g.call("POST", "/api/cart", { id: "drift", qty: 1, finish: "graphite" });
  await g.call("POST", "/api/cart", { id: "drift", qty: 2, finish: "graphite" });
  const gcart = await g.call("GET", "/api/cart");
  const drift = ((gcart.json.items) || []).find((i) => i.product.id === "drift" && i.finish === "graphite");
  check("same finish qty combines", drift && drift.qty === 3, JSON.stringify(gcart.json.items));
  const email2 = "reg2-" + Date.now() + "@nexora.test";
  check("register merge 201", (await g.call("POST", "/api/auth/register", { email: email2, password })).status === 201);
  const afterMerge = await g.call("GET", "/api/cart");
  const d2 = ((afterMerge.json.items) || []).find((i) => i.product.id === "drift");
  check("guest qty survived merge", d2 && d2.qty === 3, JSON.stringify(afterMerge.json.items));

  check(
    "duplicate generic 401",
    (await u.call("POST", "/api/auth/register", { email, password })).status === 401
  );
  const bad = await new Jar().call("POST", "/api/auth/login", { email, password: "wrongpass" });
  check("wrong password generic 401", bad.status === 401 && bad.json.error === "Invalid email or password", JSON.stringify(bad.json));

  check("logout 200", (await u.call("POST", "/api/auth/logout")).status === 200);
  check("me 401 after logout", (await u.call("GET", "/api/me")).status === 401);
  const emptyGuest = await u.call("GET", "/api/cart");
  check("logout isolation", emptyGuest.json.items.length === 0, JSON.stringify(emptyGuest.json));
  check("re-login 200", (await u.call("POST", "/api/auth/login", { email, password })).status === 200);
  const restored = await u.call("GET", "/api/cart");
  check(
    "re-login restores cart",
    ((restored.json.items) || []).some((i) => i.product.id === "vessel"),
    JSON.stringify(restored.json.items && restored.json.items.map((i) => i.product.id))
  );

  const other = new Jar();
  await other.call("POST", "/api/auth/register", { email: "oth-" + Date.now() + "@nexora.test", password });
  const otherCart = await other.call("GET", "/api/cart");
  check("cross-user cart isolated", !((otherCart.json.items) || []).some((i) => i.product.id === "vessel"));

  const sid = u.cookies.nexora_sid;
  await prisma.session.updateMany({
    where: { tokenHash: sessionService.hashToken(sid) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  check("expired session 401", (await u.call("GET", "/api/me")).status === 401);
  const u3 = new Jar();
  await u3.call("POST", "/api/auth/login", { email, password });
  check("fresh login after expiry", (await u3.call("GET", "/api/me")).status === 200);

  const snapshot = await prisma.product.findMany({ select: { id: true, stock: true, price: true } });
  const restore = async () => {
    for (const p of snapshot) {
      await prisma.product.update({ where: { id: p.id }, data: { stock: p.stock, price: p.price } });
    }
  };

  try {
    await prisma.inventoryReservation.updateMany({
      where: { productId: "arc", status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    await inventory.expireOverdueReservations();
    await prisma.product.update({ where: { id: "arc" }, data: { stock: 1 } });
    const a = new Jar();
    const b = new Jar();
    await a.call("POST", "/api/cart", { id: "arc", qty: 1, finish: "graphite" });
    await b.call("POST", "/api/cart", { id: "arc", qty: 1, finish: "graphite" });
    const [r1, r2] = await Promise.all([
      a.call("POST", "/api/orders", checkoutBody("t1a")),
      b.call("POST", "/api/orders", checkoutBody("t1b")),
    ]);
    const wins = [r1, r2].filter((r) => r.status === 201);
    const loses = [r1, r2].filter((r) => r.status === 409);
    check("concurrent last-unit 201+409", wins.length === 1 && loses.length === 1, JSON.stringify([r1.status, r2.status]));
    check("pending_payment", wins[0] && wins[0].json.status === "pending_payment", JSON.stringify(wins[0] && wins[0].json));
    check("stock still 1", (await prisma.product.findUnique({ where: { id: "arc" } })).stock === 1);

    const winnerId = wins[0].json.orderId;
    const past = new Date(Date.now() - 1000);
    await prisma.inventoryReservation.updateMany({ where: { orderId: winnerId }, data: { expiresAt: past } });
    await prisma.order.update({ where: { id: winnerId }, data: { expiresAt: past } });
    await inventory.expireOverdueReservations();
    check("expiry → expired", (await prisma.order.findUnique({ where: { id: winnerId } })).status === "expired");

    await prisma.product.update({ where: { id: "drift" }, data: { stock: 5 } });
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 5 } });
    await prisma.inventoryReservation.updateMany({
      where: { productId: { in: ["drift", "halo"] }, status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    await inventory.expireOverdueReservations();
    const d = new Jar();
    await d.call("POST", "/api/cart", { id: "drift", qty: 1, finish: "graphite" });
    await d.call("POST", "/api/cart", { id: "halo", qty: 1, finish: "midnight" });
    const two = await d.call("POST", "/api/orders", checkoutBody("two"));
    check("two-product pending", two.status === 201, two.status + " " + JSON.stringify(two.json));
    const twoId = two.json && two.json.orderId;
    const twoRes = await prisma.inventoryReservation.findMany({ where: { orderId: twoId } });
    check("two active reservations", twoRes.length === 2 && twoRes.every((r) => r.status === "active"));
    check(
      "physical stock unchanged",
      (await prisma.product.findUnique({ where: { id: "drift" } })).stock === 5 &&
        (await prisma.product.findUnique({ where: { id: "halo" } })).stock === 5
    );

    const e = new Jar();
    await e.call("POST", "/api/cart", { id: "drift", qty: 1, finish: "graphite" });
    await e.call("POST", "/api/cart", { id: "halo", qty: 1, finish: "graphite" });
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 0 } });
    const fail = await e.call("POST", "/api/orders", checkoutBody("fail"));
    check("atomic rollback 409", fail.status === 409, fail.status);
    check("no partial order", (await prisma.order.count({ where: { email: "fail@nexora.test" } })) === 0);
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 5 } });

    if (twoId) {
      const c1 = await orderService.confirmPaidOrder(twoId);
      const c2 = await orderService.confirmPaidOrder(twoId);
      check("confirmPaidOrder idempotent", c1.status === "paid" && c2.alreadyPaid === true, JSON.stringify({ c1, c2 }));
    }

    await prisma.product.update({ where: { id: "type" }, data: { stock: 4, price: 111.11 } });
    const f = new Jar();
    await f.call("POST", "/api/cart", { id: "type", qty: 1, finish: "oxide" });
    const priced = await f.call("POST", "/api/orders", checkoutBody("price"));
    await prisma.product.update({ where: { id: "type" }, data: { price: 999.99 } });
    const items =
      priced.json && priced.json.orderId
        ? await prisma.orderItem.findMany({ where: { orderId: priced.json.orderId } })
        : [];
    check("price snapshot 111.11", items.length === 1 && Number(items[0].unitPrice) === 111.11);
    if (priced.json && priced.json.orderId) await orderService.cancelOrder(priced.json.orderId);

    await prisma.product.update({ where: { id: "halo" }, data: { stock: 4 } });
    await u3.call("POST", "/api/cart", { id: "halo", qty: 1, finish: "graphite" });
    const authOrder = await u3.call("POST", "/api/orders", checkoutBody("own"));
    const oid = authOrder.json && authOrder.json.orderId;
    check("auth order pending", authOrder.status === 201, JSON.stringify(authOrder.json));
    check("owner GET 200", (await u3.call("GET", "/api/orders/" + oid)).status === 200);
    check("other GET 401/404", [401, 404].includes((await other.call("GET", "/api/orders/" + oid)).status));
    check("guest GET 401", (await new Jar().call("GET", "/api/orders/" + oid)).status === 401);
    check("no public pay", (await new Jar().call("POST", "/api/orders/NX-0001/pay", {})).status === 404);

    const oosId = "one";
    await prisma.product.update({ where: { id: oosId }, data: { stock: 3 } });
    const guestOos = new Jar();
    await guestOos.call("POST", "/api/cart", { id: oosId, qty: 1, finish: "graphite" });
    await prisma.product.update({ where: { id: oosId }, data: { stock: 0 } });
    const oosReg = await guestOos.call("POST", "/api/auth/register", {
      email: "oos-" + Date.now() + "@nexora.test",
      password,
    });
    check("OOS merge register 201", oosReg.status === 201, oosReg.status);
    const oosCart = await guestOos.call("GET", "/api/cart");
    check("OOS line dropped", !((oosCart.json.items) || []).some((i) => i.product.id === oosId));

    check(
      "origin 403",
      (
        await new Jar().call(
          "POST",
          "/api/cart",
          { id: "drift", qty: 1, finish: "graphite" },
          { Origin: "https://evil.example" }
        )
      ).status === 403
    );
    const badJson = await fetch(BASE + "/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    check("invalid JSON 400", badJson.status === 400 && (await badJson.text()).includes("Invalid JSON"));
    check("api 404", (await new Jar().call("GET", "/api/nope")).json.error === "Not found");
    const home = await fetch(BASE + "/");
    check("CSP script-src self", (home.headers.get("content-security-policy") || "").includes("script-src 'self'"));
    check("health ok", (await new Jar().call("GET", "/api/health")).json.status === "ok");
    check("page cap", (await new Jar().call("GET", "/api/products?page=100000000")).status === 400);
    check("qty null 400", (await new Jar().call("POST", "/api/cart", { id: "drift", qty: null, finish: "graphite" })).status === 400);
    const huge = await fetch(BASE + "/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x".repeat(40000) }),
    });
    check("413", huge.status === 413);
    const longu = await fetch(BASE + "/api/products?" + "a=" + "y".repeat(3000));
    check("414", longu.status === 414);
  } finally {
    try {
      await restore();
    } catch (err) {
      console.error("restore", err.message);
    }
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
  console.log(
    JSON.stringify({
      total: results.length,
      passed: results.length - fails.length,
      failed: fails.length,
      supabaseConfigured: config.supabaseConfigured,
      fails: fails.map((f) => f.name + ": " + f.detail),
    })
  );
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
