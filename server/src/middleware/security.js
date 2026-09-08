"use strict";

const rateLimit = require("express-rate-limit");
const { config } = require("../config");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again shortly." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again shortly." },
  skip: (req) => {
    const p = req.path || "";
    return p === "/health" || p === "/live" || p === "/ready";
  },
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Try again shortly." },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again shortly." },
});

const bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again shortly." },
});

function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store, private");
  res.set("Pragma", "no-cache");
  next();
}

function allowedOrigins(req) {
  const host = (req.get("host") || "").split(",")[0].trim();
  const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  const set = new Set();
  if (host) {
    set.add(`${proto}://${host}`);
    set.add(`https://${host}`);
    set.add(`http://${host}`);
  }
  for (const extra of config.allowedOrigins || []) set.add(extra);
  return set;
}

function originGuard(req, res, next) {
  const method = req.method.toUpperCase();
  if (!["POST", "PATCH", "DELETE", "PUT"].includes(method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  if (allowedOrigins(req).has(origin)) return next();
  return res.status(403).json({ error: "Forbidden" });
}

function corsAndPreflight(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();
  if (!allowedOrigins(req).has(origin)) return next();
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Max-Age", "600");
  res.append("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}

function requestHardening(req, res, next) {
  const url = req.originalUrl || req.url || "";
  if (url.length > 2048) {
    return res.status(414).json({ error: "Request URI too long" });
  }
  if (url.startsWith("/api") && url.includes("..")) {
    return res.status(404).json({ error: "Not found" });
  }
  next();
}

module.exports = {
  authLimiter,
  apiLimiter,
  checkoutLimiter,
  adminLimiter,
  bootstrapLimiter,
  noStore,
  originGuard,
  corsAndPreflight,
  requestHardening,
  allowedOrigins,
};
