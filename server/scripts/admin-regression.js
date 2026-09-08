"use strict";

/**
 * Admin/RBAC foundation suite. Does not print secrets.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");

const BOOT_EMAIL = "admin-boot-" + Date.now() + "@nexora.test";
const BOOT_SECRET = "nexora-test-bootstrap-secret-32ch";
process.env.ADMIN_BOOTSTRAP_EMAIL = BOOT_EMAIL;
process.env.ADMIN_BOOTSTRAP_SECRET = BOOT_SECRET;

const { PrismaClient } = require("@prisma/client");
const { createApp } = require("../src/app");
const { config } = require("../src/config");
const sessionService = require("../src/services/sessionService");

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
    Jar._n = (Jar._n || 20) + 1;
    this.ip = "198.51.100." + (Jar._n % 250);
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

(async () => {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const BASE = "http://127.0.0.1:" + port;
  const password = "password1";

  try {
    await prisma.adminBootstrapState.upsert({
      where: { id: "http" },
      create: { id: "http" },
      update: { consumedAt: null, consumedBy: null },
    });

    check("bootstrap env bound", config.adminBootstrapEmail === BOOT_EMAIL);
    check("styles.css size locked", fs.statSync("/home/user/styles.css").size === 40333);
    const html = await (await fetch(BASE + "/")).text();
    check("customer ui cache", html.includes("styles.css?v=15") && html.includes("app.js?v=19"));
    const front = ["app.js", "api.js", "index.html", "catalog.js", "styles.css"]
      .map((f) => fs.readFileSync(path.join("/home/user", f), "utf8"))
      .join("\n");
    check(
      "no bootstrap secret in frontend",
      !/ADMIN_BOOTSTRAP_SECRET|ADMIN_BOOTSTRAP_EMAIL/i.test(front)
    );
    check(
      "no stripe/supabase secrets in frontend",
      !/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SERVICE_ROLE|sk_live_|whsec_/i.test(front)
    );

    const anon = new Jar(BASE);
    check("unauth admin session 401", (await anon.call("GET", "/api/admin/session")).status === 401);
    check("unauth admin capabilities 401", (await anon.call("GET", "/api/admin/capabilities")).status === 401);
    check("unauth admin audit 401", (await anon.call("GET", "/api/admin/audit")).status === 401);
    check("unauth bootstrap 401", (await anon.call("POST", "/api/admin/bootstrap", { secret: "x" })).status === 401);

    const cust = new Jar(BASE);
    const email = "cust-admin-" + Date.now() + "@nexora.test";
    const reg = await cust.call("POST", "/api/auth/register", {
      email,
      password,
      role: "admin",
      isAdmin: true,
    });
    check("register 201 despite role spoof", reg.status === 201, JSON.stringify(reg.json));
    check(
      "register response not admin",
      reg.json && reg.json.user && reg.json.user.role === "customer",
      JSON.stringify(reg.json && reg.json.user)
    );
    const row = await prisma.user.findUnique({ where: { email } });
    check("db role customer after register", row && row.role === "customer", row && row.role);
    check("no hash in register json", !JSON.stringify(reg.json).includes("passwordHash"));

    const spoof = await cust.call("GET", "/api/admin/session", undefined, {
      "X-Role": "admin",
      "X-Admin": "true",
    });
    check("customer admin session 403", spoof.status === 403, spoof.status);
    check(
      "query role ignored",
      (await cust.call("GET", "/api/admin/session?role=admin")).status === 403
    );
    check("customer capabilities 403", (await cust.call("GET", "/api/admin/capabilities")).status === 403);
    check("customer audit 403", (await cust.call("GET", "/api/admin/audit")).status === 403);
    check(
      "customer unknown admin path 403",
      (await cust.call("GET", "/api/admin/orders")).status === 403
    );
    check(
      "customer cannot fake paid",
      (await cust.call("POST", "/api/admin/orders/NX-0001", { status: "paid" })).status === 403
    );

    const me = await cust.call("GET", "/api/me");
    check("me role customer", me.status === 200 && me.json.user.role === "customer", JSON.stringify(me.json));
    check("me no passwordHash", !("passwordHash" in (me.json.user || {})));
    const meStr = JSON.stringify(me.json);
    check("me no stripe secret", !/sk_live_|sk_test_|whsec_|STRIPE_SECRET/i.test(meStr));
    check("me no service-role", !/SERVICE_ROLE|service_role/i.test(meStr));

    check("no PATCH /api/me", (await cust.call("PATCH", "/api/me", { role: "admin" })).status === 404);
    check("no PUT /api/users", (await cust.call("PUT", "/api/users/" + row.id, { role: "admin" })).status === 404);
    check("no POST /api/admin/users", (await cust.call("POST", "/api/admin/users", { role: "admin" })).status === 403);

    const loginSpoof = await new Jar(BASE).call("POST", "/api/auth/login", {
      email,
      password,
      role: "admin",
    });
    check("login spoof still customer", loginSpoof.status === 200 && loginSpoof.json.user.role === "customer");

    const other = new Jar(BASE);
    await other.call("POST", "/api/auth/register", {
      email: "other-admin-" + Date.now() + "@nexora.test",
      password,
      role: "admin",
    });
    check(
      "cannot patch other user role",
      (await other.call("PATCH", "/api/users/" + row.id, { role: "admin" })).status === 404
    );
    const still = await prisma.user.findUnique({ where: { id: row.id } });
    check("victim remains customer", still.role === "customer", still.role);

    await prisma.user.update({ where: { id: row.id }, data: { role: "admin" } });
    const adminSess = await cust.call("GET", "/api/admin/session");
    check("admin session 200", adminSess.status === 200 && adminSess.json.user.role === "admin", JSON.stringify(adminSess.json));
    check("admin session no-store", (adminSess.headers.get("cache-control") || "").includes("no-store"));
    const again = await cust.call("GET", "/api/admin/session");
    check("admin session persists", again.status === 200 && again.json.user.email === email);

    const caps = await cust.call("GET", "/api/admin/capabilities");
    check(
      "capabilities foundation",
      caps.status === 200 &&
        caps.json.capabilities &&
        Array.isArray(caps.json.capabilities.products) &&
        caps.json.capabilities.orders.includes("view"),
      JSON.stringify(caps.json)
    );

    const adminStr = JSON.stringify(adminSess.json);
    check("admin payload no hash", !/passwordHash/.test(adminStr));
    check("admin payload no stripe", !/sk_live_|whsec_|STRIPE_SECRET/i.test(adminStr));

    const fakePay = await cust.call("POST", "/api/admin/orders/NX-0001", { status: "paid", stock: 999 });
    check("admin cannot mark paid (no such API)", fakePay.status === 404, fakePay.status);

    const audit = await cust.call("GET", "/api/admin/audit?page=1&perPage=10");
    check("admin audit 200", audit.status === 200 && Array.isArray(audit.json.items), JSON.stringify(audit.json));
    check("audit bad page 400", (await cust.call("GET", "/api/admin/audit?page=100000000")).status === 400);

    check(
      "admin origin 403",
      (
        await cust.call("POST", "/api/admin/bootstrap", { secret: "nope" }, { Origin: "https://evil.example" })
      ).status === 403
    );

    const badJson = await fetch(BASE + "/api/admin/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: "nexora_sid=" + cust.cookies.nexora_sid },
      body: "{",
    });
    check("malformed JSON 400", badJson.status === 400);

    const sid = cust.cookies.nexora_sid;
    await prisma.session.updateMany({
      where: { tokenHash: sessionService.hashToken(sid) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    check("expired admin session 401", (await cust.call("GET", "/api/admin/session")).status === 401);

    const relog = new Jar(BASE);
    check("re-login 200", (await relog.call("POST", "/api/auth/login", { email, password })).status === 200);
    check("admin after re-login", (await relog.call("GET", "/api/admin/session")).status === 200);
    check("logout 200", (await relog.call("POST", "/api/auth/logout")).status === 200);
    check("admin after logout 401", (await relog.call("GET", "/api/admin/session")).status === 401);

    const bogus = new Jar(BASE);
    bogus.cookies.nexora_sid = "deadbeefdeadbeefdeadbeefdeadbeef";
    check("invalid session 401", (await bogus.call("GET", "/api/admin/session")).status === 401);

    const boot = new Jar(BASE);
    const bootReg = await boot.call("POST", "/api/auth/register", { email: BOOT_EMAIL, password, role: "admin" });
    check("bootstrap user is customer", bootReg.status === 201 && bootReg.json.user.role === "customer");
    check(
      "wrong bootstrap secret 403",
      (await boot.call("POST", "/api/admin/bootstrap", { secret: "wrong-secret-value-32ch!!" })).status === 403
    );
    const bootDb = await prisma.user.findUnique({ where: { email: BOOT_EMAIL } });
    check("still customer after wrong secret", bootDb.role === "customer", bootDb.role);
    const bootOk = await boot.call("POST", "/api/admin/bootstrap", { secret: BOOT_SECRET });
    check("bootstrap 200", bootOk.status === 200 && bootOk.json.role === "admin", JSON.stringify(bootOk.json));
    check("bootstrap session admin", (await boot.call("GET", "/api/admin/session")).status === 200);
    check(
      "bootstrap reuse 409",
      (await boot.call("POST", "/api/admin/bootstrap", { secret: BOOT_SECRET })).status === 409
    );

    const cart = await boot.call("POST", "/api/cart", { id: "drift", qty: 1, finish: "graphite" });
    check("admin can still use cart", cart.status === 201 && cart.json.items && cart.json.items.length === 1);
    const order = await boot.call("POST", "/api/orders", {
      first: "Ada",
      last: "Lovelace",
      email: BOOT_EMAIL,
      address: "12 Quiet Lane, Lisbon",
    });
    check("admin customer-order still pending", order.status === 201 && order.json.status === "pending_payment");
    check("health ok", (await anon.call("GET", "/api/health")).json.status === "ok");
    check("no public pay", (await anon.call("POST", "/api/orders/NX-0001/pay", {})).status === 404);

    const neg = await prisma.product.count({ where: { stock: { lt: 0 } } });
    check("no negative stock", neg === 0);
    check("product count 64", (await prisma.product.count()) === 64);
    check("placed orders remain", (await prisma.order.count({ where: { status: "placed" } })) >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();
  }

  const fails = results.filter((r) => !r.ok);
  console.log("\n==== ADMIN SUMMARY " + (results.length - fails.length) + "/" + results.length + " ====");
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
