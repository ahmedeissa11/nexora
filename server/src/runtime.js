"use strict";

const crypto = require("crypto");

const state = {
  draining: false,
  startedAt: Date.now(),
  sweepInFlight: false,
  lastSweepAt: null,
  lastSweepOk: true,
};

const metrics = {
  requests: 0,
  status2xx: 0,
  status4xx: 0,
  status5xx: 0,
  webhookOk: 0,
  webhookFail: 0,
  webhookDuplicate: 0,
  sweeperOk: 0,
  sweeperFail: 0,
  dbFail: 0,
  orderConflict: 0,
  inventoryConflict: 0,
};

function snapshotMetrics() {
  return {
    uptimeMs: Date.now() - state.startedAt,
    draining: state.draining,
    lastSweepAt: state.lastSweepAt,
    lastSweepOk: state.lastSweepOk,
    requests: metrics.requests,
    status2xx: metrics.status2xx,
    status4xx: metrics.status4xx,
    status5xx: metrics.status5xx,
    webhookOk: metrics.webhookOk,
    webhookFail: metrics.webhookFail,
    webhookDuplicate: metrics.webhookDuplicate,
    sweeperOk: metrics.sweeperOk,
    sweeperFail: metrics.sweeperFail,
    dbFail: metrics.dbFail,
    orderConflict: metrics.orderConflict,
    inventoryConflict: metrics.inventoryConflict,
  };
}

function inc(name, n) {
  if (typeof metrics[name] !== "number") return;
  metrics[name] += n == null ? 1 : n;
}

function isDraining() {
  return state.draining === true;
}

function setDraining(value) {
  state.draining = Boolean(value);
}

function newRequestId() {
  return crypto.randomBytes(12).toString("hex");
}

function sanitizeRequestId(raw) {
  const s = String(raw || "").trim();
  if (/^[A-Za-z0-9._-]{8,128}$/.test(s)) return s;
  return newRequestId();
}

function beginSweep() {
  if (state.sweepInFlight) return false;
  state.sweepInFlight = true;
  return true;
}

function endSweep(ok) {
  state.sweepInFlight = false;
  state.lastSweepAt = Date.now();
  state.lastSweepOk = Boolean(ok);
  inc(ok ? "sweeperOk" : "sweeperFail");
}

module.exports = {
  state,
  metrics,
  snapshotMetrics,
  inc,
  isDraining,
  setDraining,
  newRequestId,
  sanitizeRequestId,
  beginSweep,
  endSweep,
};
