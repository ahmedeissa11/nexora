"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function reservationMinutes() {
  const n = Number(process.env.ORDER_RESERVATION_MINUTES || 15);
  if (!Number.isFinite(n) || n < 1 || n > 24 * 60) return 15;
  return Math.floor(n);
}

function looksLikeSupabaseUrl(value) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(value || "").trim());
}

function looksLikeSecret(value) {
  const s = String(value || "").trim();
  if (s.length < 32) return false;
  if (/YOUR_|CHANGE.?ME|placeholder|example|xxx/i.test(s)) return false;
  return true;
}

function classifyDatabaseKind(url) {
  const u = String(url || "");
  if (!u) return "missing";
  if (/[.]supabase[.](co|com)/i.test(u) || /pooler\.supabase/i.test(u)) return "supabase";
  if (/[.]neon[.]tech/i.test(u)) return "neon";
  if (/(localhost|127\.0\.0\.1)/i.test(u)) return "local";
  return "other";
}

function parsePort() {
  const prod = (process.env.NODE_ENV || "development") === "production";
  const raw = process.env.PORT;
  if (raw == null || String(raw).trim() === "") {
    return 3000;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    if (prod) throw new Error("PORT is invalid");
    return 3000;
  }
  return n;
}

function parseOrigin(value, httpsOnly) {
  const s = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  if (!s) return "";
  const re = httpsOnly ? /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i : /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i;
  return re.test(s) ? s : "";
}

const isProd = (process.env.NODE_ENV || "development") === "production";

if (/\*/.test(process.env.ALLOWED_ORIGINS || "")) {
  throw new Error("ALLOWED_ORIGINS must not contain wildcards");
}

const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const supabaseConfigured = Boolean(
  looksLikeSupabaseUrl(supabaseUrl) && looksLikeSecret(supabaseAnonKey) && looksLikeSecret(supabaseServiceRoleKey)
);

const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
const stripePublishableKey = (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
const stripeWebhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
const stripeCurrencyRaw = (process.env.STRIPE_CURRENCY || "usd").trim().toLowerCase();
const stripeCurrency = /^[a-z]{3}$/.test(stripeCurrencyRaw) ? stripeCurrencyRaw : "usd";
const stripeMock = process.env.STRIPE_MOCK === "1";
const stripeConfigured = Boolean(stripeMock || (stripeSecretKey && stripeWebhookSecret));

const adminBootstrapEmailRaw = (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const adminBootstrapEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminBootstrapEmailRaw)
  ? adminBootstrapEmailRaw
  : "";
const adminBootstrapSecret = (process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter((u) => /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(u));

const publicOrigin = parseOrigin(process.env.PUBLIC_ORIGIN || process.env.FRONTEND_ORIGIN || "", isProd);
if (publicOrigin && !allowedOrigins.includes(publicOrigin)) allowedOrigins.push(publicOrigin);

const serveStaticEnv = (process.env.SERVE_STATIC || "").trim();
const serveStatic = serveStaticEnv === "1" ? true : serveStaticEnv === "0" ? false : !isProd;

const crossSiteCookies = process.env.CROSS_SITE_COOKIES === "1";
const cookieSameSite = crossSiteCookies ? "none" : "lax";

const config = {
  env: process.env.NODE_ENV || "development",
  port: parsePort(),
  databaseUrl: required("DATABASE_URL"),
  directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  sessionSecret: required("SESSION_SECRET"),
  isProd,
  frontendRoot: require("path").resolve(__dirname, "../../.."),
  reservationMinutes: reservationMinutes(),
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  supabaseConfigured,
  databaseKind: classifyDatabaseKind(process.env.DATABASE_URL),
  stripeSecretKey,
  stripePublishableKey,
  stripeWebhookSecret,
  stripeCurrency,
  stripeMock,
  stripeConfigured,
  adminBootstrapEmail,
  adminBootstrapSecret,
  allowedOrigins,
  publicOrigin,
  serveStatic,
  crossSiteCookies,
  cookieSameSite,
};

if (config.isProd && config.databaseKind === "supabase" && !config.supabaseConfigured) {
  throw new Error(
    "Supabase Auth must be configured when DATABASE_URL is Supabase (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)"
  );
}
if (config.isProd && config.databaseKind !== "supabase" && config.databaseKind !== "neon") {
  throw new Error("Production DATABASE_URL must point at Neon or Supabase PostgreSQL");
}
if (config.isProd && !looksLikeSecret(config.sessionSecret)) {
  throw new Error("SESSION_SECRET is too weak or a placeholder");
}
if (config.isProd && config.stripeMock) {
  throw new Error("STRIPE_MOCK is not allowed in production");
}
if (config.isProd && (stripeSecretKey || stripeWebhookSecret)) {
  if (!looksLikeSecret(stripeSecretKey) || !looksLikeSecret(stripeWebhookSecret)) {
    throw new Error("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are required in production");
  }
}
if (config.isProd && !config.publicOrigin) {
  throw new Error("PUBLIC_ORIGIN must be the https frontend origin in production");
}
if (config.isProd && config.crossSiteCookies && config.allowedOrigins.length === 0) {
  throw new Error("CROSS_SITE_COOKIES requires ALLOWED_ORIGINS");
}
if (config.isProd && config.cookieSameSite === "none" && !config.crossSiteCookies) {
  throw new Error("SameSite=None requires CROSS_SITE_COOKIES=1");
}

module.exports = {
  config,
  looksLikeSupabaseUrl,
  looksLikeSecret,
  classifyDatabaseKind,
  parseOrigin,
  parsePort,
};
