"use strict";

const http = require("http");
const { logError, logInfo } = require("./utils/log");

function resolvePort() {
  const raw = process.env.PORT;
  if (raw == null || String(raw).trim() === "") return 3000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return 3000;
  return n;
}

const port = resolvePort();

function earlyHandler(req, res) {
  const url = String(req.url || "");
  const live = url === "/api/live" || url.startsWith("/api/live?");
  res.writeHead(live ? 200 : 503, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify({ status: live ? "ok" : "starting" }));
}

const server = http.createServer(earlyHandler);

let handle = null;
let stopping = false;
let shutdownFn = async function fallbackShutdown() {
  return "closed";
};

function onSignal(signal) {
  if (stopping) return;
  stopping = true;
  shutdownFn(handle, { signal, disconnectPrisma: true, timeoutMs: 15000 }).then((code) => {
    try {
      server.close();
    } catch (_err) {
      /* ignore */
    }
    process.exit(code === "timeout" ? 1 : 0);
  });
}

process.on("SIGINT", () => onSignal("SIGINT"));
process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("unhandledRejection", (err) => {
  logError("unhandledRejection", err);
});
process.on("uncaughtException", (err) => {
  logError("uncaughtException", err);
  if (handle) onSignal("uncaughtException");
});

async function boot() {
  logInfo("boot-env", {
    nodeEnv: process.env.NODE_ENV || "",
    port,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET),
    hasPublicOrigin: Boolean(process.env.PUBLIC_ORIGIN),
    hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    hasStripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
  const lifecycle = require("./lifecycle");
  shutdownFn = lifecycle.shutdown;
  handle = await lifecycle.start({ server });
}

if (require.main === module) {
  server.listen(port, "0.0.0.0", () => {
    logInfo("early-listen", { port, env: process.env.NODE_ENV || "development" });
    boot().catch((err) => {
      logError("startup", err);
    });
  });
}

module.exports = { app: null, start: boot, shutdown: shutdownFn, boot, server };
