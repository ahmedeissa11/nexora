"use strict";

/**
 * Phase 10 Admin API / CMS suite (tests A–I).
 * Does not print secrets. Does not invent Stripe or bootstrap credentials.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const orderService = require("../src/services/orderService");

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
  constructor(base) {
    this.base = base;
    this.cookies = {};
    Jar._n = (Jar._n || 40) + 1;
    this.ip = "203.0.113." + (Jar._n % 250);
    this._calls = 0;
  }
  async call(method, pathName, body, extraHeaders) {
    this._calls += 1;
    const headers = Object.assign(
      {
        Accept: "application/json",
        "X-Forwarded-For": this.ip.replace(/\.\d+$/, "." + ((this._calls + Jar._n) % 250)),
      },
      extraHeaders || {}
    );
    const cookie = Object.entries(this.cookies)
      .map(([k, v]) => k + "=" + v)
      .join("; ");
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(this.base + pathName, { method, headers, body: payload });
    parseCookies(res, this.cookies);
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text.slice(0, 300);
    }
    return { status: res.status, json, headers: res.headers, text };
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

function productPayload(id, extra) {
  return Object.assign(
    {
      id,
      name: "Admin Test " + id,
      slug: id,
      category: "Accessories",
      collection: "Studio",
      type: "Object",
      price: 128.0,
      image: "images/arc.jpg",
      meta: "graphite / 128",
      blurb: "Temporary admin API fixture. Not a catalog expansion.",
      specs: [["Finish", "Graphite"]],
      stock: 8,
    },
    extra || {}
  );
}

(async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const BASE = "http://127.0.0.1:" + port;
  const password = "password1";
  const stamp = String(Date.now());
  const testIds = [];
  const articleIds = [];
  const dropIds = [];
  const snapshot = await prisma.product.findMany({ select: { id: true, stock: true, isActive: true, price: true } });

  async function restoreCatalog() {
    for (const p of snapshot) {
      await prisma.product.update({
        where: { id: p.id },
        data: { stock: p.stock, isActive: p.isActive, price: p.price },
      });
    }
    if (testIds.length) {
      await prisma.inventoryAdjustment.deleteMany({ where: { productId: { in: testIds } } });
      await prisma.productSpec.deleteMany({ where: { productId: { in: testIds } } });
      await prisma.cartItem.deleteMany({ where: { productId: { in: testIds } } });
      await prisma.dropItem.deleteMany({ where: { productId: { in: testIds } } });
      await prisma.wishlist.deleteMany({ where: { productId: { in: testIds } } }).catch(() => {});
      await prisma.product.deleteMany({ where: { id: { in: testIds } } });
    }
    if (articleIds.length) {
      await prisma.article.deleteMany({ where: { id: { in: articleIds } } });
    }
    if (dropIds.length) {
      await prisma.drop.deleteMany({ where: { id: { in: dropIds } } });
    }
  }

  try {
    check("A styles.css locked", fs.statSync("/home/user/styles.css").size === 40333);
    const html = await (await fetch(BASE + "/")).text();
    check("A customer ui cache", html.includes("styles.css?v=15") && html.includes("app.js?v=19"));
    check("A no admin.html", !fs.existsSync("/home/user/admin.html") && !fs.existsSync("/home/user/admin/index.html"));
    const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css"]
      .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
      .join("\n");
    check("A no secrets in frontend", !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|ADMIN_BOOTSTRAP_SECRET|SERVICE_ROLE|sk_live_|whsec_/i.test(front));

    const anon = new Jar(BASE);
    const cust = new Jar(BASE);
    const admin = new Jar(BASE);
    const adminEmail = "adm-api-" + stamp + "@nexora.test";
    const custEmail = "cust-api-" + stamp + "@nexora.test";

    check("A unauth products 401", (await anon.call("GET", "/api/admin/products")).status === 401);
    check("A unauth orders 401", (await anon.call("GET", "/api/admin/orders")).status === 401);
    check("A unauth customers 401", (await anon.call("GET", "/api/admin/customers")).status === 401);
    check("A unauth stats 401", (await anon.call("GET", "/api/admin/stats")).status === 401);
    check("A unauth articles write 401", (await anon.call("POST", "/api/admin/articles", { id: "x" })).status === 401);

    const regC = await cust.call("POST", "/api/auth/register", { email: custEmail, password, role: "admin" });
    check("A customer register", regC.status === 201 && regC.json.user.role === "customer", JSON.stringify(regC.json && regC.json.user));
    check("A customer products 403", (await cust.call("GET", "/api/admin/products")).status === 403);
    check("A customer create 403", (await cust.call("POST", "/api/admin/products", productPayload("nope"))).status === 403);
    check("A customer orders 403", (await cust.call("GET", "/api/admin/orders")).status === 403);
    check("A customer fake paid 403", (await cust.call("POST", "/api/admin/orders/NX-0001", { status: "paid" })).status === 403);
    check("A customer dispatch 403", (await cust.call("POST", "/api/admin/orders/NX-0001/dispatch", {})).status === 403);
    check("A customer customers 403", (await cust.call("GET", "/api/admin/customers")).status === 403);
    check("A customer stats 403", (await cust.call("GET", "/api/admin/stats")).status === 403);

    const regA = await admin.call("POST", "/api/auth/register", { email: adminEmail, password });
    check("A admin user starts customer", regA.status === 201 && regA.json.user.role === "customer");
    const adminRow = await prisma.user.findUnique({ where: { email: adminEmail } });
    await prisma.user.update({ where: { id: adminRow.id }, data: { role: "admin" } });
    const sess = await admin.call("GET", "/api/admin/session");
    check("A admin session 200", sess.status === 200 && sess.json.user.role === "admin", JSON.stringify(sess.json));

    // B products CRUD
    const pid = "t" + stamp.slice(-10);
    testIds.push(pid);
    const created = await admin.call("POST", "/api/admin/products", productPayload(pid));
    check("B create 201", created.status === 201 && created.json.id === pid, JSON.stringify(created.json));
    check("B create physical stock", created.json.physicalStock === 8, JSON.stringify(created.json));
    check("B create no available-only", created.json.physicalStock != null && created.json.reservedQty === 0);
    const listed = await admin.call("GET", "/api/admin/products?q=" + pid + "&perPage=12");
    check("B list includes", listed.status === 200 && (listed.json.products || []).some((p) => p.id === pid));
    const got = await admin.call("GET", "/api/admin/products/" + pid);
    check("B get 200", got.status === 200 && got.json.name.includes("Admin Test"));
    const patched = await admin.call("PATCH", "/api/admin/products/" + pid, { name: "Admin Test Renamed", tagline: "Quiet object" });
    check("B patch name", patched.status === 200 && patched.json.name === "Admin Test Renamed", JSON.stringify(patched.json));
    const ratingIgnored = await admin.call("PATCH", "/api/admin/products/" + pid, { name: "Admin Test Renamed", rating: 5 });
    check("B rating not writable", ratingIgnored.status === 200 && Number(ratingIgnored.json.rating) !== 5);
    const badImg = await admin.call("POST", "/api/admin/products", productPayload("tbadimg" + stamp.slice(-6), { image: "https://evil.example/x.png" }));
    check("B reject remote image", badImg.status === 400, badImg.status);
    const stockPatch = await admin.call("PATCH", "/api/admin/products/" + pid, { stock: 999 });
    check("B raw stock patch 400", stockPatch.status === 400, stockPatch.status + " " + JSON.stringify(stockPatch.json));
    const availPatch = await admin.call("PATCH", "/api/admin/products/" + pid, { physicalStock: 999 });
    check("B raw physical patch 400", availPatch.status === 400);

    // C archive, never hard-delete
    const archived = await admin.call("DELETE", "/api/admin/products/" + pid);
    check("C delete archives", archived.status === 200 && archived.json.isActive === false, JSON.stringify(archived.json));
    const still = await prisma.product.findUnique({ where: { id: pid } });
    check("C row remains", still && still.isActive === false);
    const hard = await admin.call("DELETE", "/api/admin/products/" + pid);
    check("C idempotent archive", hard.status === 200 && hard.json.isActive === false);
    const reactivate = await admin.call("PATCH", "/api/admin/products/" + pid, { isActive: true });
    check("C reactivate", reactivate.status === 200 && reactivate.json.isActive === true);

    // D inventory
    const adj = await admin.call("POST", "/api/admin/products/" + pid + "/inventory-adjustments", {
      delta: 2,
      reason: "cycle count",
    });
    check("D adjust +2", adj.status === 201 && adj.json.resultingStock === 10, JSON.stringify(adj.json));
    const neg = await admin.call("POST", "/api/admin/products/" + pid + "/inventory-adjustments", {
      delta: -50,
      reason: "would go negative",
    });
    check("D negative blocked", neg.status === 409, neg.status + " " + JSON.stringify(neg.json));
    const zeroDelta = await admin.call("POST", "/api/admin/products/" + pid + "/inventory-adjustments", {
      delta: 0,
      reason: "noop",
    });
    check("D zero delta 400", zeroDelta.status === 400);

    await prisma.inventoryReservation.updateMany({
      where: { productId: "arc", status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    await prisma.product.update({ where: { id: "arc" }, data: { stock: 5, isActive: true } });
    const resGuest = new Jar(BASE);
    await resGuest.call("POST", "/api/cart", { id: "arc", qty: 2, finish: "graphite" });
    const reservedOrder = await resGuest.call("POST", "/api/orders", checkoutBody("resv" + stamp.slice(-6)));
    check("D reserved order pending", reservedOrder.status === 201, JSON.stringify(reservedOrder.json));
    const below = await admin.call("POST", "/api/admin/products/arc/inventory-adjustments", {
      delta: -4,
      reason: "below reserved",
    });
    check("D below reserved 409", below.status === 409, below.status + " " + JSON.stringify(below.json));
    const okFloor = await admin.call("POST", "/api/admin/products/arc/inventory-adjustments", {
      delta: -3,
      reason: "to reserved floor",
    });
    check("D to reserved floor", okFloor.status === 201 && okFloor.json.resultingStock === 2, JSON.stringify(okFloor.json));
    if (reservedOrder.json && reservedOrder.json.orderId) {
      await orderService.cancelOrder(reservedOrder.json.orderId);
    }
    const key = "idem-" + stamp;
    const firstIdem = await admin.call("POST", "/api/admin/products/" + pid + "/inventory-adjustments", {
      delta: 1,
      reason: "idempotent",
      idempotencyKey: key,
    });
    const secondIdem = await admin.call("POST", "/api/admin/products/" + pid + "/inventory-adjustments", {
      delta: 1,
      reason: "idempotent",
      idempotencyKey: key,
    });
    check(
      "D idempotent replay",
      firstIdem.status === 201 && secondIdem.json && secondIdem.json.replayed === true && secondIdem.json.resultingStock === firstIdem.json.resultingStock,
      JSON.stringify({ firstIdem: firstIdem.json, secondIdem: secondIdem.json })
    );

    // I inactive hidden from customer (uses pid while we archive)
    const liveCust = await cust.call("GET", "/api/products/" + pid);
    check("I customer sees active fixture", liveCust.status === 200, liveCust.status);
    await admin.call("DELETE", "/api/admin/products/" + pid);
    const gone = await cust.call("GET", "/api/products/" + pid);
    check("I customer get archived 404", gone.status === 404, gone.status);
    const search = await cust.call("GET", "/api/search?q=" + encodeURIComponent("Admin Test Renamed"));
    check("I search hides archived", search.status === 200 && !((search.json.products || []).some((p) => p.id === pid)));
    const addArchived = await cust.call("POST", "/api/cart", { id: pid, qty: 1, finish: "graphite" });
    check("I cart add archived 404", addArchived.status === 404, addArchived.status);
    await admin.call("PATCH", "/api/admin/products/" + pid, { isActive: true });
    await cust.call("POST", "/api/cart", { id: pid, qty: 1, finish: "graphite" });
    await admin.call("DELETE", "/api/admin/products/" + pid);
    const placeArchived = await cust.call("POST", "/api/orders", checkoutBody("arch" + stamp.slice(-6)));
    check("I checkout archived 409", placeArchived.status === 409, placeArchived.status + " " + JSON.stringify(placeArchived.json));
    await admin.call("PATCH", "/api/admin/products/" + pid, { isActive: true });

    const home = await anon.call("GET", "/api/home");
    check("I home featured omit archived", home.status === 200 && !((home.json.featured || []).some((p) => p.id === pid && pid)));

    // E orders
    await prisma.inventoryReservation.updateMany({
      where: { productId: "halo", status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    await prisma.product.update({ where: { id: "halo" }, data: { stock: 6, isActive: true } });
    const og = new Jar(BASE);
    await og.call("POST", "/api/cart", { id: "halo", qty: 1, finish: "graphite" });
    const pending = await og.call("POST", "/api/orders", checkoutBody("ordp" + stamp.slice(-6)));
    const pendingId = pending.json && pending.json.orderId;
    check("E pending created", pending.status === 201 && pendingId, JSON.stringify(pending.json));
    const olist = await admin.call("GET", "/api/admin/orders?status=pending_payment&perPage=20");
    check("E list pending", olist.status === 200 && (olist.json.orders || []).some((o) => o.id === pendingId));
    const oget = await admin.call("GET", "/api/admin/orders/" + pendingId);
    check("E get has email not hash", oget.status === 200 && oget.json.email && !("guestAccessHash" in oget.json) && !("passwordHash" in oget.json));
    const fakePaid = await admin.call("POST", "/api/admin/orders/" + pendingId, { status: "paid" });
    check("E mark paid 404", fakePaid.status === 404, fakePaid.status);
    const dispPending = await admin.call("POST", "/api/admin/orders/" + pendingId + "/dispatch", {});
    check("E dispatch pending 409", dispPending.status === 409, dispPending.status);
    const cancelPending = await admin.call("POST", "/api/admin/orders/" + pendingId + "/cancel", {});
    check("E cancel pending", cancelPending.status === 200 && cancelPending.json.status === "cancelled", JSON.stringify(cancelPending.json));

    const og2 = new Jar(BASE);
    await og2.call("POST", "/api/cart", { id: "halo", qty: 1, finish: "midnight" });
    const toPay = await og2.call("POST", "/api/orders", checkoutBody("ordd" + stamp.slice(-6)));
    const payId = toPay.json && toPay.json.orderId;
    check("E second pending", toPay.status === 201 && payId);
    await orderService.confirmPaidOrder(payId);
    const disp = await admin.call("POST", "/api/admin/orders/" + payId + "/dispatch", {});
    check("E dispatch paid", disp.status === 200 && disp.json.status === "dispatched", JSON.stringify(disp.json));
    const disp2 = await admin.call("POST", "/api/admin/orders/" + payId + "/dispatch", {});
    check("E dispatch idempotent", disp2.status === 200 && disp2.json.status === "dispatched");
    const placed = await prisma.order.findFirst({ where: { status: "placed" } });
    if (placed) {
      const dispPlaced = await admin.call("POST", "/api/admin/orders/" + placed.id + "/dispatch", {});
      check("E placed terminal dispatch", dispPlaced.status === 409, dispPlaced.status);
      const cancelPlaced = await admin.call("POST", "/api/admin/orders/" + placed.id + "/cancel", {});
      check("E placed terminal cancel", cancelPlaced.status === 409, cancelPlaced.status);
    } else {
      check("E placed terminal dispatch", false, "no placed order");
      check("E placed terminal cancel", false, "no placed order");
    }

    // F customers
    const clist = await admin.call("GET", "/api/admin/customers?q=" + encodeURIComponent(custEmail));
    check("F list customers", clist.status === 200 && (clist.json.customers || []).some((u) => u.email === custEmail));
    const clistStr = JSON.stringify(clist.json);
    check("F no passwordHash", !/passwordHash/.test(clistStr));
    check("F no token leak", !/nexora_sid|passwordHash|guestAccessHash|sk_live_|whsec_/i.test(clistStr));
    const custRow = await prisma.user.findUnique({ where: { email: custEmail } });
    const cget = await admin.call("GET", "/api/admin/customers/" + custRow.id);
    check("F get customer", cget.status === 200 && cget.json.role === "customer" && !("passwordHash" in cget.json));
    const badRole = await admin.call("PATCH", "/api/admin/customers/" + custRow.id, { role: "superadmin" });
    check("F role allowlist", badRole.status === 400, badRole.status);
    const promo = await admin.call("PATCH", "/api/admin/customers/" + custRow.id, { role: "admin" });
    check("F promote", promo.status === 200 && promo.json.role === "admin", JSON.stringify(promo.json));
    const demo = await admin.call("PATCH", "/api/admin/customers/" + custRow.id, { role: "customer" });
    check("F demote non-last", demo.status === 200 && demo.json.role === "customer");
    await prisma.user.updateMany({
      where: { role: "admin", id: { not: adminRow.id } },
      data: { role: "customer" },
    });
    const last = await admin.call("PATCH", "/api/admin/customers/" + adminRow.id, { role: "customer" });
    check("F last-admin protected", last.status === 409, last.status + " " + JSON.stringify(last.json));
    const stillAdmin = await prisma.user.findUnique({ where: { id: adminRow.id } });
    check("F last admin remains", stillAdmin.role === "admin");

    // G CMS
    const aid = "note-" + stamp.slice(-8);
    articleIds.push(aid);
    const art = await admin.call("POST", "/api/admin/articles", {
      id: aid,
      kind: "Essay",
      date: "07 Sep 2026",
      title: "Admin note",
      excerpt: "A short house note.",
      body: ["A treated room is a decision.", "We keep only that test."],
    });
    check("G article create", art.status === 201 && art.json.id === aid, JSON.stringify(art.json));
    const pub = await anon.call("GET", "/api/articles/" + aid);
    check("G public article", pub.status === 200 && pub.json.title === "Admin note");
    const artPatch = await admin.call("PATCH", "/api/admin/articles/" + aid, { title: "Admin note edited" });
    check("G article patch", artPatch.status === 200 && artPatch.json.title === "Admin note edited");
    const artDel = await admin.call("DELETE", "/api/admin/articles/" + aid);
    check("G article delete", artDel.status === 200 && artDel.json.ok === true);
    check("G public article gone", (await anon.call("GET", "/api/articles/" + aid)).status === 404);

    const drop = await admin.call("POST", "/api/admin/drops", {
      endsAt: "2026-10-15T20:00:00.000Z",
      items: [{ productId: "drift", sort: 0 }, { productId: "halo", sort: 1 }],
    });
    check("G drop create", drop.status === 201 && drop.json.id && drop.json.items.length === 2, JSON.stringify(drop.json));
    if (drop.json && drop.json.id) dropIds.push(drop.json.id);
    const badDrop = await admin.call("POST", "/api/admin/drops", {
      endsAt: "2026-10-15T20:00:00.000Z",
      items: [{ productId: "does-not-exist-sku", sort: 0 }],
    });
    check("G drop unknown product", badDrop.status === 400, badDrop.status);
    if (drop.json && drop.json.id) {
      const dropPatch = await admin.call("PATCH", "/api/admin/drops/" + drop.json.id, {
        items: [{ productId: "type", sort: 0 }],
      });
      check("G drop patch", dropPatch.status === 200 && dropPatch.json.items.length === 1 && dropPatch.json.items[0].productId === "type");
      const dropDel = await admin.call("DELETE", "/api/admin/drops/" + drop.json.id);
      check("G drop delete", dropDel.status === 200);
      dropIds.splice(0, dropIds.length);
    }

    // H stats
    const st = await admin.call("GET", "/api/admin/stats");
    check("H stats 200", st.status === 200 && st.json.revenue && Array.isArray(st.json.revenue.includes), JSON.stringify(st.json));
    const paidSum = await prisma.order.aggregate({
      where: { status: { in: ["paid", "dispatched"] } },
      _sum: { total: true },
      _count: true,
    });
    const allSum = await prisma.order.aggregate({ _sum: { total: true } });
    const placedSum = await prisma.order.aggregate({
      where: { status: "placed" },
      _sum: { total: true },
    });
    const reported = Number(st.json.revenue.total);
    const expected = Number(paidSum._sum.total || 0);
    check("H revenue paid+dispatched only", reported === Number(expected.toFixed ? expected.toFixed(2) : expected) || Math.abs(reported - expected) < 0.001, reported + " vs " + expected);
    check("H revenue excludes placed in contract", (st.json.revenue.excludes || []).includes("placed"));
    if (Number(placedSum._sum.total || 0) > 0) {
      check("H revenue != all-orders sum", Math.abs(reported - Number(allSum._sum.total || 0)) > 0.001, reported + " all=" + allSum._sum.total);
    } else {
      check("H placed totals exist", (await prisma.order.count({ where: { status: "placed" } })) >= 1);
    }
    check("H products total 64+fixture", st.json.products.total >= 64);

    // H/I audit
    const audit = await admin.call("GET", "/api/admin/audit?perPage=50");
    const actions = (audit.json.items || []).map((i) => i.action);
    check("I audit product.create", actions.includes("product.create"), actions.slice(0, 20).join(","));
    check("I audit inventory.adjust", actions.includes("inventory.adjust"));
    check("I audit product.archive", actions.includes("product.archive"));
    check("I audit order.dispatch", actions.includes("order.dispatch"));
    check("I audit no secrets", !/passwordHash|sk_live_|whsec_|ADMIN_BOOTSTRAP/i.test(JSON.stringify(audit.json)));

    check("E no public pay", (await anon.call("POST", "/api/orders/NX-0001/pay", {})).status === 404);
    check("A health", (await anon.call("GET", "/api/health")).json.status === "ok");
  } finally {
    try {
      await restoreCatalog();
    } catch (err) {
      console.error("cleanup", err && err.message ? err.message : err);
    }
    const left = await prisma.product.count();
    check("I product count restored 64", left === 64, left);
    const negStock = await prisma.product.count({ where: { stock: { lt: 0 } } });
    check("I no negative stock", negStock === 0);
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== ADMIN API SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
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
  console.error(e);
  process.exit(1);
});
