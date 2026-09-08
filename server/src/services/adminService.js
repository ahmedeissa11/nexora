"use strict";

const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { config } = require("../config");
const { unauthorized, forbidden, conflict, notFound, badRequest } = require("../utils/errors");
const { ROLES, ADMIN_CAPABILITIES, normalizeRole, isAdminRole } = require("./rbac");
const audit = require("./auditService");
const { parsePagination } = require("../utils/pagination");

const BOOTSTRAP_ID = "http";

function secretsEqual(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string") return false;
  if (!provided || !expected) return false;
  const digestA = crypto.createHmac("sha256", "nexora-bootstrap").update(provided).digest();
  const digestB = crypto.createHmac("sha256", "nexora-bootstrap").update(expected).digest();
  const hashOk = crypto.timingSafeEqual(digestA, digestB);
  return hashOk && provided.length === expected.length;
}

function bootstrapConfigured() {
  return Boolean(config.adminBootstrapEmail && config.adminBootstrapSecret);
}

function sessionPayload(admin) {
  return {
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name || null,
      role: ROLES.ADMIN,
    },
  };
}

function capabilities() {
  return { capabilities: ADMIN_CAPABILITIES };
}

async function promoteExistingUser(email, { actorId, via }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw notFound("Not found");
  if (isAdminRole(user.role)) {
    return { id: user.id, email: user.email, role: ROLES.ADMIN, alreadyAdmin: true };
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: ROLES.ADMIN },
  });
  await audit.append({
    actorId: actorId || updated.id,
    action: "admin.promote",
    targetType: "user",
    targetId: updated.id,
    metadata: { via: via || "unknown" },
  });
  return { id: updated.id, email: updated.email, role: ROLES.ADMIN, alreadyAdmin: false };
}

async function bootstrap({ userId, email, secret }) {
  if (!userId || !email) throw unauthorized("Sign in required");
  if (!bootstrapConfigured()) throw notFound("Not found");

  if (typeof secret !== "string") throw badRequest("Invalid details");
  if (!secretsEqual(secret, config.adminBootstrapSecret)) throw forbidden("Not allowed");
  if (email !== config.adminBootstrapEmail) throw forbidden("Not allowed");

  return prisma.$transaction(async (tx) => {
    const state = await tx.adminBootstrapState.findUnique({ where: { id: BOOTSTRAP_ID } });
    if (!state) {
      await tx.adminBootstrapState.create({ data: { id: BOOTSTRAP_ID } });
    }
    const locked = await tx.$queryRaw`SELECT id FROM "AdminBootstrapState" WHERE id = ${BOOTSTRAP_ID} FOR UPDATE`;
    if (!locked || !locked.length) throw notFound("Not found");
    const current = await tx.adminBootstrapState.findUnique({ where: { id: BOOTSTRAP_ID } });
    if (current.consumedAt) throw conflict("Already used");

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== config.adminBootstrapEmail) throw forbidden("Not allowed");

    await tx.user.update({
      where: { id: user.id },
      data: { role: ROLES.ADMIN },
    });
    await tx.adminBootstrapState.update({
      where: { id: BOOTSTRAP_ID },
      data: { consumedAt: new Date(), consumedBy: user.id },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "admin.bootstrap",
        targetType: "user",
        targetId: user.id,
        metadata: { via: "http" },
      },
    });
    return { ok: true, role: ROLES.ADMIN };
  });
}

async function listAudit(query) {
  const { page, perPage, skip } = parsePagination(query || {});
  const [total, rows] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
  ]);
  return {
    page,
    perPage,
    total,
    items: rows.map(audit.publicEntry),
  };
}

module.exports = {
  bootstrapConfigured,
  sessionPayload,
  capabilities,
  promoteExistingUser,
  bootstrap,
  listAudit,
  normalizeRole,
  secretsEqual,
};
