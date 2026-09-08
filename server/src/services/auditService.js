"use strict";

const { prisma } = require("../db/prisma");

const FORBIDDEN_META = /password|secret|token|authorization|cookie|service.?role|sk_live|sk_test|whsec_|apikey|api_key/i;

function sanitizeMetadata(meta) {
  if (meta == null) return null;
  if (typeof meta !== "object" || Array.isArray(meta)) return null;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_META.test(key)) continue;
    if (typeof value === "string") {
      if (FORBIDDEN_META.test(value)) continue;
      if (value.length > 500) out[key] = value.slice(0, 500);
      else out[key] = value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (value == null) {
      out[key] = null;
    }
  }
  return Object.keys(out).length ? out : null;
}

function auditData({ actorId, action, targetType, targetId, metadata }) {
  return {
    actorId: actorId || null,
    action: typeof action === "string" ? action.slice(0, 80) : "unknown",
    targetType: typeof targetType === "string" ? targetType.slice(0, 40) : "unknown",
    targetId: typeof targetId === "string" ? targetId.slice(0, 191) : null,
    metadata: sanitizeMetadata(metadata),
  };
}

async function append(fields) {
  await prisma.auditLog.create({ data: auditData(fields) });
}

async function appendTx(tx, fields) {
  await tx.auditLog.create({ data: auditData(fields) });
}

function publicEntry(row) {
  return {
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

module.exports = { append, appendTx, sanitizeMetadata, publicEntry };
