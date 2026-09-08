"use strict";

const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const { badRequest, notFound, conflict } = require("../utils/errors");
const { assertOrderId, assertString, escapeLike } = require("../utils/validate");
const { parsePagination } = require("../utils/pagination");
const inventory = require("./inventoryService");
const orderService = require("./orderService");
const audit = require("./auditService");

const { ORDER } = inventory;

const ADMIN_STATUSES = new Set([
  ORDER.PENDING_PAYMENT,
  ORDER.PAID,
  ORDER.CANCELLED,
  ORDER.EXPIRED,
  ORDER.DISPATCHED,
  ORDER.PLACED,
]);

function dec(value) {
  return new Prisma.Decimal(value);
}

function money(value) {
  return Number(dec(value).toFixed(2));
}

function serializeAdminOrder(order) {
  const out = {
    id: order.id,
    status: order.status,
    email: order.email,
    firstName: order.firstName,
    lastName: order.lastName,
    address: order.address,
    subtotal: money(order.subtotal),
    shipping: money(order.shipping),
    total: money(order.total),
    currency: order.currency || "usd",
    createdAt: order.createdAt.toISOString(),
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      name: item.name,
      image: item.image,
      qty: item.qty,
      finish: item.finish,
      unitPrice: money(item.unitPrice),
    })),
  };
  if (order.expiresAt) out.expiresAt = order.expiresAt.toISOString();
  if (order.paidAt) out.paidAt = order.paidAt.toISOString();
  if (order.cancelledAt) out.cancelledAt = order.cancelledAt.toISOString();
  if (order.expiredAt) out.expiredAt = order.expiredAt.toISOString();
  if (order.dispatchedAt) out.dispatchedAt = order.dispatchedAt.toISOString();
  if (order.cancelRequestedAt) out.cancelRequestedAt = order.cancelRequestedAt.toISOString();
  if (order.paymentProvider) out.paymentProvider = order.paymentProvider;
  if (order.paymentReference) out.paymentReference = order.paymentReference;
  return out;
}

const INCLUDE = { items: { orderBy: { id: "asc" } } };

async function listOrders(query) {
  const { page, perPage, skip } = parsePagination(query || {});
  const where = {};
  if (query && query.status) {
    if (!ADMIN_STATUSES.has(query.status)) throw badRequest("Invalid status");
    where.status = query.status;
  }
  const rawQ = typeof (query && query.q) === "string" ? query.q.trim() : "";
  if (rawQ.length > 120) throw badRequest("Invalid search query");
  const q = rawQ ? escapeLike(rawQ) : "";
  if (rawQ && !q) return { orders: [], total: 0, page, perPage };
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
  ]);
  return { orders: rows.map(serializeAdminOrder), total, page, perPage };
}

async function getOrder(id) {
  const oid = assertOrderId(id);
  const order = await prisma.order.findUnique({ where: { id: oid }, include: INCLUDE });
  if (!order) throw notFound("Not found");
  return serializeAdminOrder(order);
}

async function cancel(id, actorId) {
  const oid = assertOrderId(id);
  const existing = await prisma.order.findUnique({ where: { id: oid } });
  if (!existing) throw notFound("Not found");
  if (existing.status === ORDER.PLACED) throw conflict("Order cannot be cancelled");
  const result = await orderService.cancelOrder(oid);
  await audit.append({
    actorId,
    action: result.cancelRequested ? "order.cancel_requested" : "order.cancel",
    targetType: "order",
    targetId: oid,
    metadata: { status: result.status },
  });
  const order = await prisma.order.findUnique({ where: { id: oid }, include: INCLUDE });
  return serializeAdminOrder(order);
}

async function dispatch(id, actorId) {
  const oid = assertOrderId(id);
  const result = await orderService.dispatchOrder(oid);
  if (!result.alreadyDispatched) {
    await audit.append({
      actorId,
      action: "order.dispatch",
      targetType: "order",
      targetId: oid,
    });
  }
  const order = await prisma.order.findUnique({ where: { id: oid }, include: INCLUDE });
  return serializeAdminOrder(order);
}

module.exports = { listOrders, getOrder, cancel, dispatch, serializeAdminOrder };
