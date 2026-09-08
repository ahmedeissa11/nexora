"use strict";

const runtime = require("../runtime");

function requestId(req, res, next) {
  const id = runtime.sanitizeRequestId(req.get("x-request-id"));
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

function rejectIfDraining(req, res, next) {
  if (!runtime.isDraining()) return next();
  const url = req.originalUrl || req.url || "";
  if (url === "/api/live" || url.startsWith("/api/live?")) return next();
  return res.status(503).json({ error: "Service unavailable" });
}

module.exports = { requestId, rejectIfDraining };
