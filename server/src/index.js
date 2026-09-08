"use strict";

const { start, shutdown } = require("./lifecycle");
const { logError } = require("./utils/log");
const { createApp } = require("./app");

let handle = null;
let stopping = false;

async function boot() {
  handle = await start();
}

function onSignal(signal) {
  if (stopping) return;
  stopping = true;
  shutdown(handle, { signal, disconnectPrisma: true, timeoutMs: 15000 }).then((code) => {
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
  onSignal("uncaughtException");
});

if (require.main === module) {
  boot().catch((err) => {
    logError("startup", err);
    process.exit(1);
  });
}

module.exports = { app: null, createApp, start, shutdown, boot };
