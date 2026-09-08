"use strict";

const { prisma } = require("../db/prisma");
const { badRequest, notFound, conflict } = require("../utils/errors");
const { assertString, pickFields, escapeLike, assertEnum } = require("../utils/validate");
const { parsePagination } = require("../utils/pagination");
const { ROLES, isAdminRole } = require("./rbac");
const audit = require("./auditService");

function assertUserId(value) {
  if (typeof value !== "string" || !/^[a-z0-9_-]{8,40}$/i.test(value)) {
    throw badRequest("Invalid id");
  }
  return value;
}

function serializeAdminUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name || null,
    role: row.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.CUSTOMER,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    orderCount: row._count && typeof row._count.orders === "number" ? row._count.orders : undefined,
  };
}

const SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { orders: true } },
};

async function listCustomers(query) {
  const { page, perPage, skip } = parsePagination(query || {});
  const where = {};
  if (query && query.role) {
    where.role = assertEnum(query.role, "role", [ROLES.CUSTOMER, ROLES.ADMIN]);
  }
  const rawQ = typeof (query && query.q) === "string" ? query.q.trim() : "";
  if (rawQ.length > 120) throw badRequest("Invalid search query");
  const q = rawQ ? escapeLike(rawQ) : "";
  if (rawQ && !q) return { customers: [], total: 0, page, perPage };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: SAFE_SELECT,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
  ]);
  return { customers: rows.map(serializeAdminUser), total, page, perPage };
}

async function getCustomer(id) {
  const uid = assertUserId(id);
  const row = await prisma.user.findUnique({ where: { id: uid }, select: SAFE_SELECT });
  if (!row) throw notFound("Not found");
  return serializeAdminUser(row);
}

async function updateCustomer(id, body, actorId) {
  const uid = assertUserId(id);
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const src = pickFields(body, ["role"]);
  if (src.role == null) throw badRequest("Invalid details");
  const nextRole = assertEnum(src.role, "role", [ROLES.CUSTOMER, ROLES.ADMIN]);

  const existing = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, role: true },
  });
  if (!existing) throw notFound("Not found");
  const prevRole = existing.role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.CUSTOMER;
  if (prevRole === nextRole) {
    const row = await prisma.user.findUnique({ where: { id: uid }, select: SAFE_SELECT });
    return serializeAdminUser(row);
  }

  if (isAdminRole(prevRole) && nextRole !== ROLES.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN } });
    if (adminCount <= 1) throw conflict("Cannot demote the last admin");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id: uid },
      data: { role: nextRole },
      select: SAFE_SELECT,
    });
    await audit.appendTx(tx, {
      actorId,
      action: nextRole === ROLES.ADMIN ? "customer.promote" : "customer.demote",
      targetType: "user",
      targetId: uid,
      metadata: { from: prevRole, to: nextRole },
    });
    return row;
  });
  return serializeAdminUser(updated);
}

module.exports = { listCustomers, getCustomer, updateCustomer, serializeAdminUser };
