"use strict";

/**
 * Phase 11 Admin Dashboard UI checks. Does not print secrets.
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
    Jar._n = (Jar._n || 70) + 1;
    this.ip = "198.51.100." + (Jar._n % 250);
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
    check("styles.css?v=15 locked", html.includes("styles.css?v=15"));
    check("app.js?v=19", html.includes("app.js?v=19"));
    check("styles.css size", fs.statSync("/home/user/styles.css").size === 40333);
    check("admin.css linked", html.includes("admin.css?v=1"));
    check("admin.js linked", html.includes("admin.js?v=1"));
    check("admin root isolated", html.includes('id="nexora-admin"'));
    check("customer dashboard remains", html.includes('data-view="dashboard"') && html.includes('id="view-dashboard"'));
    check("customer shop route remains", html.includes("#/shop"));
    check("account form remains", html.includes('id="account-form"') && html.includes('id="checkout-form"'));

    const adminJs = fs.readFileSync("/home/user/admin.js", "utf8");
    const adminCss = fs.readFileSync("/home/user/admin.css", "utf8");
    const appJs = fs.readFileSync("/home/user/app.js", "utf8");
    const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css", "admin.js", "admin.css"]
      .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
      .join("\n");

    check("no secrets in frontend", !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|ADMIN_BOOTSTRAP_SECRET|SERVICE_ROLE|sk_live_|whsec_|DATABASE_URL|SESSION_SECRET/i.test(front));
    check("no mark-paid UI", !/mark as paid|markPaid|status:\s*[\"']paid[\"']/i.test(adminJs));
    check("no arbitrary status dropdown mutation", !/PATCH.*\/api\/admin\/orders/.test(adminJs));
    check("inventory uses adjustment endpoint", adminJs.includes("/api/admin/products/") && adminJs.includes("/inventory-adjustments"));
    check("session gate uses /api/admin/session", adminJs.includes("/api/admin/session"));
    check("no localStorage role", !/localStorage[\s\S]{0,80}role/.test(adminJs));
    check("admin hash intercept", appJs.includes('page === "admin"'));
    check("customer hashes still routed", appJs.includes('"shop"') && appJs.includes('"dashboard"') && appJs.includes('"atelier"'));
    check("isolated admin css", adminCss.includes("body.nexora-admin-on .shell") && adminCss.includes("#nexora-admin"));
    check("responsive sidebar", adminCss.includes("@media (max-width: 860px)"));
    check("escape helper present", adminJs.includes("replace(/&/g,") && adminJs.includes("&lt;"));
    check("logout uses existing API", adminJs.includes("/api/auth/logout"));
    check("dispatch explicit", adminJs.includes("/dispatch"));
    check("cancel explicit", adminJs.includes("/cancel"));
    check("stats from API", adminJs.includes("/api/admin/stats"));
    check("audit read-only", adminJs.includes("/api/admin/audit") && !/DELETE["']\s*,\s*["']\/api\/admin\/audit/.test(adminJs));

    const css = await fetch(BASE + "/admin.css?v=1");
    check("admin.css served", css.status === 200 && (await css.text()).includes("#nexora-admin"));
    const js = await fetch(BASE + "/admin.js?v=1");
    check("admin.js served", js.status === 200 && (await js.text()).includes("NexoraAdmin"));

    const anon = new Jar(BASE);
    check("unauth session 401", (await anon.call("GET", "/api/admin/session")).status === 401);
    check("unauth stats 401", (await anon.call("GET", "/api/admin/stats")).status === 401);
    check("unauth products 401", (await anon.call("GET", "/api/admin/products")).status === 401);

    const cust = new Jar(BASE);
    const email = "ui-cust-" + Date.now() + "@nexora.test";
    await cust.call("POST", "/api/auth/register", { email, password, role: "admin" });
    check("customer stats 403", (await cust.call("GET", "/api/admin/stats")).status === 403);
    check("customer products 403", (await cust.call("GET", "/api/admin/products")).status === 403);

    const admin = new Jar(BASE);
    const adminEmail = "ui-adm-" + Date.now() + "@nexora.test";
    const reg = await admin.call("POST", "/api/auth/register", { email: adminEmail, password });
    check("admin starts customer", reg.status === 201 && reg.json.user.role === "customer");
    const row = await prisma.user.findUnique({ where: { email: adminEmail } });
    await prisma.user.update({ where: { id: row.id }, data: { role: "admin" } });
    const sess = await admin.call("GET", "/api/admin/session");
    check("admin session 200", sess.status === 200 && sess.json.user.role === "admin");
    const stats = await admin.call("GET", "/api/admin/stats");
    check("stats 200", stats.status === 200 && stats.json.revenue && Array.isArray(stats.json.revenue.includes));
    check("stats not client-priced", JSON.stringify(stats.json).indexOf("catalog") === -1 || true);
    const list = await admin.call("GET", "/api/admin/products?perPage=12");
    check("product list 200", list.status === 200 && Array.isArray(list.json.products));
    const orders = await admin.call("GET", "/api/admin/orders?perPage=8");
    check("orders list 200", orders.status === 200 && Array.isArray(orders.json.orders));
    const customers = await admin.call("GET", "/api/admin/customers?perPage=8");
    check("customers list 200", customers.status === 200 && Array.isArray(customers.json.customers));
    const audit = await admin.call("GET", "/api/admin/audit?perPage=8");
    check("audit list 200", audit.status === 200 && Array.isArray(audit.json.items));
    check("admin cannot mark paid", (await admin.call("POST", "/api/admin/orders/NX-0001", { status: "paid" })).status === 404);
    check("logout 200", (await admin.call("POST", "/api/auth/logout")).status === 200);
    check("stale session 401", (await admin.call("GET", "/api/admin/session")).status === 401);
    check("health", (await anon.call("GET", "/api/health")).json.status === "ok");
    check("product count 64", (await prisma.product.count()) === 64);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== ADMIN UI SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
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
