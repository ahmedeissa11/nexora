"use strict";

const { pingDatabase } = require("../db/prisma");
const { config } = require("../config");
const runtime = require("../runtime");

function live(_req, res) {
  res.json({ status: "ok" });
}

async function pingOrFail() {
  try {
    await pingDatabase();
    return true;
  } catch (_err) {
    runtime.inc("dbFail");
    return false;
  }
}

async function ready(_req, res) {
  if (runtime.isDraining()) {
    return res.status(503).json({ status: "error" });
  }
  const ok = await pingOrFail();
  if (!ok) {
    if (config.isProd) return res.status(503).json({ status: "error" });
    return res.status(503).json({ status: "error", database: "disconnected" });
  }
  if (config.isProd) return res.json({ status: "ok" });
  return res.json({
    status: "ok",
    database: "connected",
    draining: false,
    metrics: runtime.snapshotMetrics(),
  });
}

async function health(_req, res) {
  if (runtime.isDraining()) {
    return res.status(503).json({ status: "error" });
  }
  try {
    await pingDatabase();
    if (config.isProd) {
      return res.json({ status: "ok" });
    }
    return res.json({
      status: "ok",
      database: "connected",
      databaseKind: config.databaseKind,
      supabaseAuth: config.supabaseConfigured ? "configured" : "not_configured",
    });
  } catch (err) {
    runtime.inc("dbFail");
    if (config.isProd) {
      return res.status(503).json({ status: "error" });
    }
    return res.status(500).json({ status: "error", database: "disconnected", error: "Database unavailable" });
  }
}

module.exports = { health, live, ready };
