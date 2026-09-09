"use strict";

/**
 * Vercel build: write public config.js from NEXORA_API_BASE.
 * Never writes secrets. Empty / invalid values keep same-origin /api.
 */
const fs = require("fs");
const path = require("path");

const dest = path.join(__dirname, "..", "config.js");
// Same-origin /api so Vercel can rewrite to Express (first-party cookies on iOS).
// A remote NEXORA_API_BASE is ignored on Vercel; rewrites handle the API host.
const raw = String(process.env.NEXORA_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");
if (raw && /localhost|127\.0\.0\.1/i.test(raw) && process.env.VERCEL === "1") {
  throw new Error("NEXORA_API_BASE must not be localhost on Vercel");
}
const ok = "";

const body =
  "/* PUBLIC frontend config. No secrets. Empty base = same-origin /api. */\n" +
  "window.NEXORA_API_BASE = " +
  JSON.stringify(ok) +
  ";\n";

fs.writeFileSync(dest, body, "utf8");
console.log("wrote config.js apiBase=" + (ok ? "custom" : "same-origin"));
