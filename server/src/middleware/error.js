"use strict";

const { HttpError, conflict, notFound, serviceUnavailable } = require("../utils/errors");
const { logError } = require("../utils/log");
const runtime = require("../runtime");

function isApiRequest(req) {
  const url = req.originalUrl || req.url || "";
  return req.path.startsWith("/api") || url.startsWith("/api");
}

function notFoundHandler(req, res) {
  return res.status(404).json({ error: "Not found" });
}

function mapKnownError(err) {
  if (!err) return null;
  const code = err.code;
  if (code === "P2002") return conflict("Conflict");
  if (code === "P2025") return notFound();
  if (code === "P2034") return conflict("Conflict");
  if (code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017" || code === "P2024") {
    return serviceUnavailable("Service unavailable");
  }
  return null;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400 && "body" in err)) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({ error: "Request too large" });
  }

  const mapped = mapKnownError(err);
  const use = mapped || err;

  const status = use.status || (use instanceof HttpError ? use.status : 500);
  const safeStatus = [400, 401, 403, 404, 409, 413, 414, 429, 500, 503].includes(status) ? status : 500;

  if (safeStatus === 500 || safeStatus === 503) {
    logError("http", use, { requestId: req && req.requestId });
  }

  let message;
  if (safeStatus === 500) {
    message = "Internal server error";
  } else if (mapped) {
    message = mapped.message;
  } else {
    message = use.message || "Something went wrong";
  }

  res.status(safeStatus).json({ error: message });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFoundHandler, errorHandler, asyncHandler, isApiRequest, mapKnownError };
