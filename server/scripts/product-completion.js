"use strict";

/**
 * Phase 16 customer-journey completion checks.
 * Does not print secrets. Does not mark orders paid.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");

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
  async call(method, pathName, body) {
    this._calls += 1;
    const headers = {
      Accept: "application/json",
      "X-Forwarded-For": this.ip.replace(/\.\d+$/, "." + ((this._calls + Jar._n) % 250)),
    };
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
      json = text.slice(0, 200);
    }
    return { status: res.status, json, text, headers: res.headers };
  }
}

(async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const BASE = "http://127.0.0.1:" + server.address().port;
  const password = "password1";

  try {
    const html = await (await fetch(BASE + "/")).text();
    const appJs = fs.readFileSync("/home/user/app.js", "utf8");
    const index = fs.readFileSync("/home/user/index.html", "utf8");

    check("styles.css?v=15 locked", html.includes("styles.css?v=15"));
    check("app.js?v=19", html.includes("app.js?v=19"));
    check("styles.css size", fs.statSync("/home/user/styles.css").size === 40333);
    check("honest checkout lede", index.includes("Stripe Checkout") && !/Payment is simulated/i.test(index));
    check("continue to payment", index.includes("Continue to payment") && index.includes('id="checkout-submit"'));
    check("checkout success is reserved not placed", index.includes("Your order is reserved.") && !/Your order is placed/i.test(index));
    check("cart shows subtotal and shipping", index.includes('id="cart-subtotal"') && index.includes('id="cart-shipping"'));
    check("mobile menu journal + house", index.includes('data-nav="journal"') && index.includes("#/dashboard"));
    check("single html document", index.split("</html>").length - 1 === 1);
    check("shop hash clears category", appJs.includes('params.get("cat") || "All"'));
    check("OOS cannot add", appJs.includes("isOutOfStock") && appJs.includes("currently between lots"));
    check("stripe-unavailable copy is pending", appJs.includes("Stripe Checkout was not available"));
    check("dashboard logout", index.includes('id="dash-logout"') && index.includes('id="dash-actions"'));
    check("dashboard default logged-out copy", index.includes("Sign in to see orders and a quiet profile"));
    check("dash-orders is a container", /id="dash-orders"/.test(index) && !/<p id="dash-orders">/.test(index));
    check("checkout view-orders", index.includes('id="checkout-orders"'));

    check("cart PATCH qty", appJs.includes('apiSend("PATCH", "/api/cart"'));
    check("cart qty controls", appJs.includes("data-qty-delta") && appJs.includes("function setCartQty"));
    check("PDP finishes and qty", appJs.includes("data-pdp-qty") && appJs.includes('class="swatch'));
    check("home API", appJs.includes('apiGet("/api/home")'));
    check("articles API", appJs.includes('apiGet("/api/articles")'));
    check("shop chip writes hash", appJs.includes("#/shop?cat="));
    check("newsletter posts subscribe", appJs.includes('"/api/subscribe"'));
    check("customer logout on dashboard", appJs.includes('id="dash-logout"') || appJs.includes("dash-logout"));
    check("orders list + detail", appJs.includes('"/api/orders"') && appJs.includes('"/api/orders/"'));
    check("no fake mark-paid", !/mark as paid|markPaid|fake.?paid|Payment is simulated/i.test(appJs + index));
    check("no public pay helper", !/\/api\/orders\/.*\/pay/.test(appJs));

    const anon = new Jar(BASE);
    const home = await anon.call("GET", "/api/home");
    check(
      "GET /api/home 200",
      home.status === 200 &&
        Array.isArray(home.json.featured) &&
        home.json.drop &&
        Array.isArray(home.json.drop.products) &&
        Array.isArray(home.json.arrivals),
      JSON.stringify({ status: home.status, keys: home.json && Object.keys(home.json) })
    );
    check(
      "home drop has endsAt",
      home.json.drop && (home.json.drop.endsAt === null || typeof home.json.drop.endsAt === "string")
    );
    const products = await anon.call("GET", "/api/products?perPage=8");
    const sample = products.json && products.json.products && products.json.products[0];
    check(
      "product flags present",
      sample &&
        typeof sample.isFeatured === "boolean" &&
        typeof sample.isArrival === "boolean" &&
        typeof sample.isDrop === "boolean",
      JSON.stringify(sample && { id: sample.id, isFeatured: sample.isFeatured })
    );

    const articles = await anon.call("GET", "/api/articles");
    check(
      "GET /api/articles 200",
      articles.status === 200 && Array.isArray(articles.json.articles) && articles.json.articles.length >= 1,
      JSON.stringify(articles.json && { n: articles.json.articles && articles.json.articles.length })
    );

    const email = "sub-" + Date.now() + "@nexora.test";
    const sub1 = await anon.call("POST", "/api/subscribe", { email });
    const sub2 = await anon.call("POST", "/api/subscribe", { email });
    check("subscribe 200", sub1.status === 200 && sub1.json && sub1.json.ok === true, JSON.stringify(sub1.json));
    check("subscribe duplicate 200", sub2.status === 200 && sub2.json && sub2.json.ok === true, JSON.stringify(sub2.json));
    check("subscribe no-store", (sub1.headers.get("cache-control") || "").includes("no-store"));
    const badSub = await anon.call("POST", "/api/subscribe", { email: "not-an-email" });
    check("subscribe invalid 400", badSub.status === 400, badSub.status);

    const guest = new Jar(BASE);
    const add = await guest.call("POST", "/api/cart", { id: "vessel", qty: 1, finish: "graphite" });
    check("cart add 201", add.status === 201, add.status);
    const patched = await guest.call("PATCH", "/api/cart", { id: "vessel", qty: 2, finish: "graphite" });
    const line = ((patched.json && patched.json.items) || []).find(
      (i) => i.product.id === "vessel" && i.finish === "graphite"
    );
    check("cart PATCH qty 2", patched.status === 200 && line && line.qty === 2, JSON.stringify(patched.json && patched.json.items));
    const zero = await guest.call("PATCH", "/api/cart", { id: "vessel", qty: 0, finish: "graphite" });
    check("cart PATCH qty 0 rejected", zero.status === 400, zero.status);
    const removed = await guest.call("DELETE", "/api/cart/vessel/graphite");
    check(
      "cart DELETE empties line",
      removed.status === 200 && !((removed.json.items) || []).some((i) => i.product.id === "vessel"),
      JSON.stringify(removed.json && removed.json.items)
    );

    const user = new Jar(BASE);
    const ue = "p16-" + Date.now() + "@nexora.test";
    const reg = await user.call("POST", "/api/auth/register", { email: ue, password });
    check("register 201", reg.status === 201, JSON.stringify(reg.json));
    await user.call("POST", "/api/cart", { id: "vessel", qty: 1, finish: "graphite" });
    const placed = await user.call("POST", "/api/orders", {
      first: "Ada",
      last: "Lovelace",
      email: ue,
      address: "12 Quiet Lane, Lisbon",
    });
    check("order pending_payment", placed.status === 201 && placed.json.status === "pending_payment", JSON.stringify(placed.json));
    const list = await user.call("GET", "/api/orders");
    check("GET /api/orders is array", list.status === 200 && Array.isArray(list.json), list.status);
    const oid = placed.json && placed.json.orderId;
    const listed = Array.isArray(list.json) && list.json.find((o) => o.id === oid);
    check(
      "list includes items + totals",
      listed && Array.isArray(listed.items) && typeof listed.total === "number" && typeof listed.subtotal === "number",
      JSON.stringify(listed && { id: listed.id, keys: Object.keys(listed) })
    );
    const detail = await user.call("GET", "/api/orders/" + oid);
    check(
      "GET /api/orders/:id 200",
      detail.status === 200 && detail.json.id === oid && Array.isArray(detail.json.items) && detail.json.items.length >= 1,
      JSON.stringify(detail.json && { id: detail.json.id, status: detail.json.status })
    );
    check("no public pay", (await anon.call("POST", "/api/orders/" + oid + "/pay", {})).status === 404);
    check("logout 200", (await user.call("POST", "/api/auth/logout")).status === 200);
    check("orders 401 after logout", (await user.call("GET", "/api/orders")).status === 401);

    check("product count 64", (await prisma.product.count()) === 64);
    check("health", (await anon.call("GET", "/api/health")).json.status === "ok");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== PRODUCT COMPLETION SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
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
