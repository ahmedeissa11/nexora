"use strict";

const { config } = require("./config");
const { createApp } = require("./app");
const { startReservationSweeper } = require("./services/inventoryService");
const { pingDatabase, prisma } = require("./db/prisma");
const { logInfo, logError } = require("./utils/log");
const runtime = require("./runtime");

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, "0.0.0.0", () => resolve(server));
    server.on("error", reject);
  });
}

async function start(opts = {}) {
  const app = createApp();
  const stopSweeper = startReservationSweeper();
  let httpServer = opts.server;
  if (httpServer) {
    httpServer.removeAllListeners("request");
    httpServer.on("request", app);
    logInfo("listen", {
      port: config.port,
      env: config.env,
      stripe: config.stripeConfigured ? "configured" : "not_configured",
      mode: "attach",
    });
  } else {
    httpServer = await listen(app);
    logInfo("listen", {
      port: config.port,
      env: config.env,
      stripe: config.stripeConfigured ? "configured" : "not_configured",
      mode: "bind",
    });
  }

  try {
    await pingDatabase();
  } catch (err) {
    runtime.inc("dbFail");
    logError("startup-db", err);
    if (config.isProd) {
      logError("startup-db", { message: "DATABASE_URL unreachable; HTTP port is live" });
    }
  }

  return { app, server: httpServer, stopSweeper };
}

function shutdown(handle, { signal, disconnectPrisma = true, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    runtime.setDraining(true);
    logInfo("shutdown", { signal: signal || "stop" });
    if (handle && typeof handle.stopSweeper === "function") {
      try {
        handle.stopSweeper();
      } catch (err) {
        logError("shutdown-sweeper", err);
      }
    }
    const timer = setTimeout(() => {
      logError("shutdown", { message: "timeout" });
      if (disconnectPrisma) {
        prisma.$disconnect().finally(() => resolve("timeout"));
      } else {
        resolve("timeout");
      }
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    const finish = (code) => {
      clearTimeout(timer);
      resolve(code);
    };

    const server = handle && handle.server;
    if (!server || typeof server.close !== "function") {
      if (disconnectPrisma) {
        prisma.$disconnect().then(() => finish("closed")).catch(() => finish("closed"));
      } else {
        finish("closed");
      }
      return;
    }

    server.close(() => {
      if (!disconnectPrisma) return finish("closed");
      prisma
        .$disconnect()
        .catch((err) => logError("disconnect", err))
        .finally(() => finish("closed"));
    });
  });
}

module.exports = { start, shutdown, listen };
