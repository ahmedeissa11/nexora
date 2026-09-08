"use strict";

/**
 * Stripe payment suite. Uses STRIPE_MOCK unless real test-mode keys exist.
 * Never prints secret values.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");

const hasLive =
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
  /^sk_test_/.test(process.env.STRIPE_SECRET_KEY) &&
  String(process.env.STRIPE_SECRET_KEY).length > 20 &&
  String(process.env.STRIPE_WEBHOOK_SECRET).startsWith("whsec_");

if (!hasLive) {
  process.env.STRIPE_MOCK = "1";
  if (!process.env.STRIPE_WEBHOOK_SECRET) process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_nexora";
  process.env.STRIPE_CURRENCY = process.env.STRIPE_CURRENCY || "usd";
}

const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const { config } = require("../src/config");
const orderService = require("../src/services/orderService");
const paymentService = require("../src/services/paymentService");
const stripeService = require("../src/services/stripeService");
const inventory = require("../src/services/inventoryService");
const cartService = require("../src/services/cartService");


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
    Jar._n = (Jar._n || 10) + 1;
    this.ip = "203.0.113." + (Jar._n % 250);
  }
  async call(method, pathName, body, extraHeaders) {
    const headers = Object.assign(
      { Accept: "application/json", "X-Forwarded-For": this.ip },
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

function completedEvent(session, extras = {}) {
  return {
    id: extras.eventId || "evt_test_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
    object: "event",
    type: extras.type || "checkout.session.completed",
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        payment_status: extras.payment_status != null ? extras.payment_status : "paid",
        amount_total: extras.amount_total != null ? extras.amount_total : session.amount_total,
        currency: extras.currency != null ? extras.currency : session.currency,
        metadata: { orderId: extras.orderId || session.metadata.orderId },
        payment_intent: session.payment_intent,
        client_reference_id: session.client_reference_id,
      },
    },
  };
}

(async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const BASE = "http://127.0.0.1:" + port;
  const origin = BASE;

  const snapshot = await prisma.product.findMany({ select: { id: true, stock: true, price: true } });
  const restore = async () => {
    for (const p of snapshot) {
      await prisma.product.update({ where: { id: p.id }, data: { stock: p.stock, price: p.price } });
    }
  };

  try {
    const html = await (await fetch(BASE + "/")).text();
    check("styles.css?v=15 locked", html.includes("styles.css?v=15"));
    check("app.js?v=19", html.includes("app.js?v=19"));
    const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css"]
      .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
      .join("\n");
    check("no stripe secrets in frontend", !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|whsec_/i.test(front));
    check("no service-role in frontend", !/SERVICE_ROLE|supabaseServiceRole/i.test(front));
    check("hosted checkout plumbing", front.includes("checkout-session") && front.includes("settleCheckoutReturn"));
    check("stripe mock or test mode", stripeService.isConfigured(), "not configured");
    check("currency usd", config.stripeCurrency === "usd", config.stripeCurrency);
    check("styles.css size locked", fs.statSync("/home/user/styles.css").size === 40333);

    const guest = new Jar(BASE);
    await guest.call("POST", "/api/cart", { id: "type", qty: 1, finish: "oxide" });
    const placed = await guest.call("POST", "/api/orders", checkoutBody("stripe-guest"));
    check("pending order creation", placed.status === 201 && placed.json.status === "pending_payment", JSON.stringify(placed.json));
    check("nexora_oid cookie", Boolean(guest.cookies.nexora_oid));
    const orderId = placed.json.orderId;

    const tampered = await guest.call("POST", "/api/orders/" + orderId + "/checkout-session", {
      unitPrice: 1,
      subtotal: 1,
      shipping: 0,
      total: 1,
      currency: "eur",
      quantity: 99,
      productId: "vessel",
      finish: "midnight",
      amount: 50,
    });
    check("checkout session 200", tampered.status === 200 && tampered.json && tampered.json.url, JSON.stringify(tampered.json));
    check(
      "checkout url hosted",
      tampered.json && /^https:\/\/checkout\.stripe\.com\//.test(tampered.json.url),
      tampered.json && tampered.json.url
    );
    const params = stripeService.getLastCheckoutParams();
    const unit = params && params.line_items && params.line_items[0] && params.line_items[0].price_data.unit_amount;
    const typeRow = await prisma.product.findUnique({ where: { id: "type" }, select: { price: true } });
    const expectedCents = paymentService.toCents(typeRow.price);
    check("server-side unit_amount", unit === expectedCents, String(unit) + " vs " + expectedCents);
    check("ignores client total", params && params.line_items[0].price_data.currency === "usd");
    check("metadata orderId", params && params.metadata && params.metadata.orderId === orderId);

    const other = new Jar(BASE);
    const password = "password1";
    await other.call("POST", "/api/auth/register", {
      email: "stripe-oth-" + Date.now() + "@nexora.test",
      password,
    });
    const cross = await other.call("POST", "/api/orders/" + orderId + "/checkout-session", { total: 1 });
    check("cross-user payment 401/404", [401, 404].includes(cross.status), cross.status);
    const crossGet = await other.call("GET", "/api/orders/" + orderId);
    check("cross-user GET 401/404", [401, 404].includes(crossGet.status), crossGet.status);

    const invalid = await guest.call("POST", "/api/orders/not-an-id/checkout-session", {});
    check("invalid order id", [400, 404].includes(invalid.status), invalid.status);
    const missing = await guest.call("POST", "/api/orders/NX-000000/checkout-session", {});
    check("missing order 404", missing.status === 404, missing.status);

    const ownerGet = await guest.call("GET", "/api/orders/" + orderId);
    check("guest owner GET 200", ownerGet.status === 200 && ownerGet.json.status === "pending_payment", ownerGet.status);
    const anonGet = await new Jar(BASE).call("GET", "/api/orders/" + orderId);
    check("anon GET 401", anonGet.status === 401, anonGet.status);

    const stripe = stripeService.getClient();
    if (!tampered.json || !tampered.json.sessionId) {
      check("checkout session created", false, JSON.stringify(tampered.json));
      throw new Error("checkout session missing; aborting remaining payment tests");
    }
    const sessionId = tampered.json.sessionId;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const badSig = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify(completedEvent(session)),
    });
    check("invalid webhook signature", badSig.status === 400, badSig.status);

    const noSig = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completedEvent(session)),
    });
    check("missing webhook signature", noSig.status === 400, noSig.status);

    const failEvt = completedEvent(session, {
      eventId: "evt_fail_" + Date.now(),
      type: "payment_intent.payment_failed",
    });
    const signedFail = stripeService.signTestPayload(failEvt);
    const failRes = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedFail.header },
      body: signedFail.payload,
    });
    const afterFail = await prisma.order.findUnique({ where: { id: orderId } });
    check("payment failure not paid", failRes.status === 200 && afterFail.status === "pending_payment", afterFail.status);

    const typeStockBefore = (await prisma.product.findUnique({ where: { id: "type" } })).stock;
    const paidEvt = completedEvent(session);
    const signedPaid = stripeService.signTestPayload(paidEvt);
    const paidRes = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedPaid.header },
      body: signedPaid.payload,
    });
    const paidJson = await paidRes.json().catch(() => ({}));
    const afterPaid = await prisma.order.findUnique({
      where: { id: orderId },
      include: { reservations: true },
    });
    const typeStockAfter = (await prisma.product.findUnique({ where: { id: "type" } })).stock;
    check("valid webhook 200", paidRes.status === 200 && paidJson.received === true, JSON.stringify(paidJson));
    check("order paid", afterPaid.status === "paid" && afterPaid.paidAt, afterPaid.status);
    check("stock decremented once", typeStockAfter === typeStockBefore - 1, typeStockAfter + " vs " + typeStockBefore);
    check(
      "reservation consumed once",
      afterPaid.reservations.length === 1 && afterPaid.reservations[0].status === "consumed",
      afterPaid.reservations.map((r) => r.status).join(",")
    );

    const dup = await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedPaid.header },
      body: signedPaid.payload,
    });
    const dupJson = await dup.json().catch(() => ({}));
    const stockDup = (await prisma.product.findUnique({ where: { id: "type" } })).stock;
    check("duplicate webhook idempotent", dup.status === 200 && dupJson.duplicate === true, JSON.stringify(dupJson));
    check("duplicate does not decrement", stockDup === typeStockAfter, String(stockDup));

    const paidAgain = await guest.call("POST", "/api/orders/" + orderId + "/checkout-session", {});
    check("already-paid session 409", paidAgain.status === 409, paidAgain.status + " " + JSON.stringify(paidAgain.json));

    const guestPaid = await guest.call("GET", "/api/orders/" + orderId);
    check("paid GET status from server", guestPaid.status === 200 && guestPaid.json.status === "paid", JSON.stringify(guestPaid.json));

    const noPay = await new Jar(BASE).call("POST", "/api/orders/" + orderId + "/pay", {});
    check("no public pay", noPay.status === 404, noPay.status);

    const originDeny = await guest.call(
      "POST",
      "/api/orders/" + orderId + "/checkout-session",
      {},
      { Origin: "https://evil.example" }
    );
    check("origin 403 on pay", originDeny.status === 403, originDeny.status);

    const mismatchEvt = completedEvent(session, {
      eventId: "evt_amt_" + Date.now(),
      amount_total: 1,
      orderId,
    });
    // already paid — even mismatched later events must not change stock
    const signedMis = stripeService.signTestPayload(mismatchEvt);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedMis.header },
      body: signedMis.payload,
    });
    const stockMis = (await prisma.product.findUnique({ where: { id: "type" } })).stock;
    check("post-paid mismatch no extra decrement", stockMis === typeStockAfter, String(stockMis));

    await prisma.product.update({ where: { id: "halo" }, data: { stock: 4, price: 111.11 } });
    const g2 = new Jar(BASE);
    await g2.call("POST", "/api/cart", { id: "halo", qty: 1, finish: "graphite" });
    const snapOrder = await g2.call("POST", "/api/orders", checkoutBody("stripe-price"));
    await prisma.product.update({ where: { id: "halo" }, data: { price: 999.99 } });
    const snapPay = await g2.call("POST", "/api/orders/" + snapOrder.json.orderId + "/checkout-session", {
      unitPrice: 9.99,
      total: 9.99,
      currency: "eur",
    });
    const snapParams = stripeService.getLastCheckoutParams();
    const snapUnit = snapParams.line_items[0].price_data.unit_amount;
    check("price snapshot 11111 cents", snapUnit === 11111, String(snapUnit));
    check("currency not eur", snapParams.line_items[0].price_data.currency === "usd");

    const snapSession = await stripe.checkout.sessions.retrieve(snapPay.json.sessionId);
    const eurEvt = completedEvent(snapSession, { eventId: "evt_eur_" + Date.now(), currency: "eur" });
    const signedEur = stripeService.signTestPayload(eurEvt);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedEur.header },
      body: signedEur.payload,
    });
    const afterEur = await prisma.order.findUnique({ where: { id: snapOrder.json.orderId } });
    check("currency tamper webhook not paid", afterEur.status === "pending_payment", afterEur.status);

    const lowEvt = completedEvent(snapSession, { eventId: "evt_low_" + Date.now(), amount_total: 1 });
    const signedLow = stripeService.signTestPayload(lowEvt);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedLow.header },
      body: signedLow.payload,
    });
    const afterLow = await prisma.order.findUnique({ where: { id: snapOrder.json.orderId } });
    check("amount tamper webhook not paid", afterLow.status === "pending_payment", afterLow.status);

    const goodSnap = completedEvent(snapSession, { eventId: "evt_snap_ok_" + Date.now() });
    const signedSnap = stripeService.signTestPayload(goodSnap);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedSnap.header },
      body: signedSnap.payload,
    });
    const afterSnap = await prisma.order.findUnique({ where: { id: snapOrder.json.orderId } });
    check("snapshot webhook pays 111.11 order", afterSnap.status === "paid", afterSnap.status);

    await prisma.inventoryReservation.updateMany({
      where: { productId: "arc", status: "active" },
      data: { status: "released", releasedAt: new Date() },
    });
    await inventory.expireOverdueReservations();
    await prisma.product.update({ where: { id: "arc" }, data: { stock: 1 } });
    const a = new Jar(BASE);
    const b = new Jar(BASE);
    await a.call("POST", "/api/cart", { id: "arc", qty: 1, finish: "graphite" });
    await b.call("POST", "/api/cart", { id: "arc", qty: 1, finish: "graphite" });
    const [r1, r2] = await Promise.all([
      a.call("POST", "/api/orders", checkoutBody("stripe-a")),
      b.call("POST", "/api/orders", checkoutBody("stripe-b")),
    ]);
    const wins = [r1, r2].filter((r) => r.status === 201);
    const loses = [r1, r2].filter((r) => r.status === 409);
    check("concurrent last-unit 201+409", wins.length === 1 && loses.length === 1, JSON.stringify([r1.status, r2.status]));
    const winJar = r1.status === 201 ? a : b;
    const winId = wins[0].json.orderId;
    const stockStill = (await prisma.product.findUnique({ where: { id: "arc" } })).stock;
    check("physical stock still 1 while reserved", stockStill === 1, String(stockStill));
    const winPay = await winJar.call("POST", "/api/orders/" + winId + "/checkout-session", {});
    const winSession = await stripe.checkout.sessions.retrieve(winPay.json.sessionId);
    const winEvt = completedEvent(winSession, { eventId: "evt_win_" + Date.now() });
    const signedWin = stripeService.signTestPayload(winEvt);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedWin.header },
      body: signedWin.payload,
    });
    const arcPaid = await prisma.product.findUnique({ where: { id: "arc" } });
    const winOrder = await prisma.order.findUnique({ where: { id: winId }, include: { reservations: true } });
    check("pay consumes last unit", arcPaid.stock === 0 && winOrder.status === "paid", arcPaid.stock + " " + winOrder.status);
    const signedWin2 = stripeService.signTestPayload(completedEvent(winSession, { eventId: "evt_win2_" + Date.now() }));
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedWin2.header },
      body: signedWin2.payload,
    });
    const arcDup = (await prisma.product.findUnique({ where: { id: "arc" } })).stock;
    check("second event no extra consume", arcDup === 0, String(arcDup));

    await prisma.product.update({ where: { id: "drift" }, data: { stock: 5 } });
    const expJar = new Jar(BASE);
    await expJar.call("POST", "/api/cart", { id: "drift", qty: 1, finish: "graphite" });
    const expOrder = await expJar.call("POST", "/api/orders", checkoutBody("stripe-exp"));
    const expId = expOrder.json.orderId;
    const past = new Date(Date.now() - 1000);
    await prisma.inventoryReservation.updateMany({ where: { orderId: expId }, data: { expiresAt: past } });
    await prisma.order.update({ where: { id: expId }, data: { expiresAt: past } });
    await inventory.expireOverdueReservations();
    const expPay = await expJar.call("POST", "/api/orders/" + expId + "/checkout-session", {});
    check("expired order cannot pay", expPay.status === 409, expPay.status + " " + JSON.stringify(expPay.json));
    const expiredRow = await prisma.order.findUnique({ where: { id: expId } });
    check("expired status", expiredRow.status === "expired", expiredRow.status);

    const fakeSession = {
      id: "cs_test_expired_fake",
      amount_total: paymentService.toCents(expiredRow.total),
      currency: "usd",
      metadata: { orderId: expId },
      payment_intent: "pi_test_expired",
      client_reference_id: expId,
    };
    const expEvt = completedEvent(fakeSession, { eventId: "evt_expired_wh_" + Date.now() });
    const signedExp = stripeService.signTestPayload(expEvt);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedExp.header },
      body: signedExp.payload,
    });
    const stillExp = await prisma.order.findUnique({ where: { id: expId } });
    check("expired webhook does not pay", stillExp.status === "expired", stillExp.status);

    const placedIdRows = await prisma.$queryRaw`SELECT nextval('nexora_order_seq') AS n`;
    const placedId = `NX-${String(Number(placedIdRows[0].n)).padStart(4, "0")}`;
    await prisma.order.create({
      data: {
        id: placedId,
        email: "legacy-placed@nexora.test",
        firstName: "Legacy",
        lastName: "Placed",
        address: "1 Archive Row, Lisbon",
        status: "placed",
        subtotal: 10,
        shipping: 0,
        total: 10,
        currency: "usd",
      },
    });
    const placedSession = {
      id: "cs_test_placed",
      amount_total: 1000,
      currency: "usd",
      metadata: { orderId: placedId },
      payment_intent: "pi_test_placed",
      client_reference_id: placedId,
    };
    const placedEvt = completedEvent(placedSession, { eventId: "evt_placed_" + Date.now() });
    const signedPlaced = stripeService.signTestPayload(placedEvt);
    await fetch(BASE + "/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": signedPlaced.header },
      body: signedPlaced.payload,
    });
    const stillPlaced = await prisma.order.findUnique({ where: { id: placedId } });
    check("legacy placed unchanged", stillPlaced.status === "placed", stillPlaced.status);

    const authJar = new Jar(BASE);
    const authReg = await authJar.call("POST", "/api/auth/register", {
      email: "stripe-user-" + Date.now() + "@nexora.test",
      password: "password1",
    });
    check("auth register", authReg.status === 201, JSON.stringify(authReg.json));
    await authJar.call("POST", "/api/cart", { id: "vessel", qty: 1, finish: "graphite" });
    const authOrder = await authJar.call("POST", "/api/orders", checkoutBody("stripe-auth"));
    check("auth pending", authOrder.status === 201, JSON.stringify(authOrder.json));
    const authPay = await authJar.call("POST", "/api/orders/" + authOrder.json.orderId + "/checkout-session", {});
    check("auth checkout session", authPay.status === 200, JSON.stringify(authPay.json));
    const guestPayAuth = await new Jar(BASE).call(
      "POST",
      "/api/orders/" + authOrder.json.orderId + "/checkout-session",
      {}
    );
    check("guest cannot pay auth order", [401, 404].includes(guestPayAuth.status), guestPayAuth.status);

    const neg = await prisma.product.count({ where: { stock: { lt: 0 } } });
    check("no negative stock", neg === 0, String(neg));
    check("product count 64", (await prisma.product.count()) === 64, await prisma.product.count());
    const stripeEvents = await prisma.stripeEvent.count();
    check("stripe events recorded", stripeEvents >= 1, String(stripeEvents));

    const cancelJar = new Jar(BASE);
    await cancelJar.call("POST", "/api/cart", { id: "vessel", qty: 1, finish: "midnight" });
    const cancelOrder = await cancelJar.call("POST", "/api/orders", checkoutBody("stripe-cancel"));
    check("abandoned checkout stays pending", cancelOrder.json && cancelOrder.json.status === "pending_payment");
  } finally {
    try {
      await restore();
    } catch (err) {
      console.error("restore", err.message);
    }
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== STRIPE SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
  console.log(
    JSON.stringify({
      total: results.length,
      passed: results.length - fails.length,
      failed: fails.length,
      liveStripe: hasLive,
      stripeMock: config.stripeMock,
      fails: fails.map((f) => f.name + ": " + f.detail),
    })
  );
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
