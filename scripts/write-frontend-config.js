"use strict";

/**
 * Vercel build: write public config.js from NEXORA_API_BASE.
 * Never writes secrets. Invalid / localhost values are rejected.
 * If unset, fall back to the live Express origin so checkout is not same-origin 404.
 */
const fs = require("fs");
const path = require("path");

const dest = path.join(__dirname, "..", "config.js");
const FALLBACK = "https://finer-valuable-polar-bear.abasthan.app";
const raw = String(process.env.NEXORA_API_BASE || FALLBACK)
  .trim()
  .replace(/\/+$/, "");
const ok = raw && /^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(raw) ? raw : FALLBACK;
if (/localhost|127\.0\.0\.1/i.test(ok) && process.env.VERCEL === "1") {
  throw new Error("NEXORA_API_BASE must not be localhost on Vercel");
}

const body =
  "/* PUBLIC frontend config. No secrets. Empty base = same-origin /api. */\n" +
  "window.NEXORA_API_BASE = " +
  JSON.stringify(ok) +
  ";\n";

fs.writeFileSync(dest, body, "utf8");
console.log("wrote config.js apiBase=" + (ok ? "custom" : "same-origin"));
