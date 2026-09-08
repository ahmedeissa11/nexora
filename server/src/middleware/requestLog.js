"use strict";

const runtime = require("../runtime");
const { logInfo } = require("../utils/log");

const SKIP = /^\/api\/(live|ready|health)(?:\/|\?|$)/;

function requestLog(req, res, next) {
  runtime.inc("requests");
  const started = Date.now();
  const pathOnly = String(req.originalUrl || req.url || "").split("?")[0];
  res.on("finish", () => {
    const status = res.statusCode || 0;
    if (status >= 500) runtime.inc("status5xx");
    else if (status >= 400) runtime.inc("status4xx");
    else runtime.inc("status2xx");
    if (status === 409) {
      if (/inventory/.test(pathOnly)) runtime.inc("inventoryConflict");
      else runtime.inc("orderConflict");
    }
    if (SKIP.test(pathOnly)) return;
    logInfo("http", {
      level: status >= 500 ? "error" : "info",
      requestId: req.requestId || null,
      method: req.method,
      path: pathOnly,
      status,
      ms: Date.now() - started,
    });
  });
  next();
}

module.exports = { requestLog };
