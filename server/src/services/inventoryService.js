"use strict";

const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const { mapProduct } = require("../utils/mapProduct");
const { config } = require("../config");
const { logError } = require("../utils/log");

const RESERVATION = {
  ACTIVE: "active",
  RELEASED: "released",
  CONSUMED: "consumed",
  EXPIRED: "expired",
};

const ORDER = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  DISPATCHED: "dispatched",
  PLACED: "placed",
};

function reservationWindowMs() {
  return config.reservationMinutes * 60 * 1000;
}

function reservationExpiresAt(from = new Date()) {
  return new Date(from.getTime() + reservationWindowMs());
}

function availableFrom(physical, reserved) {
  return Math.max(0, Number(physical || 0) - Number(reserved || 0));
}

async function lockProducts(tx, productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))].sort();
  if (!ids.length) return ids;
  await tx.$queryRaw`
    SELECT id FROM "Product"
    WHERE id IN (${Prisma.join(ids)})
    ORDER BY id
    FOR UPDATE
  `;
  return ids;
}

async function lockOrder(tx, orderId) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
}

async function reservedQtyMap(tx, productIds, now = new Date()) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await tx.inventoryReservation.groupBy({
    by: ["productId"],
    where: {
      productId: { in: ids },
      status: RESERVATION.ACTIVE,
      expiresAt: { gt: now },
    },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.qty || 0]));
}

async function expireOverdueForProducts(tx, productIds, now = new Date()) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) return { reservations: 0, orders: 0 };

  const overdue = await tx.inventoryReservation.findMany({
    where: {
      productId: { in: ids },
      status: RESERVATION.ACTIVE,
      expiresAt: { lte: now },
    },
    select: { id: true, orderId: true },
  });
  if (!overdue.length) return { reservations: 0, orders: 0 };

  await tx.inventoryReservation.updateMany({
    where: { id: { in: overdue.map((r) => r.id) }, status: RESERVATION.ACTIVE },
    data: { status: RESERVATION.EXPIRED, releasedAt: now },
  });

  const orderIds = [...new Set(overdue.map((r) => r.orderId))];
  let orders = 0;
  for (const orderId of orderIds) {
    const stillActive = await tx.inventoryReservation.count({
      where: { orderId, status: RESERVATION.ACTIVE },
    });
    if (stillActive === 0) {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: ORDER.PENDING_PAYMENT },
        data: { status: ORDER.EXPIRED, expiredAt: now },
      });
      orders += updated.count;
    }
  }
  return { reservations: overdue.length, orders };
}

async function expirePendingWithoutActive(tx, now = new Date()) {
  const orphans = await tx.$queryRaw`
    SELECT o.id FROM "Order" o
    WHERE o.status = ${ORDER.PENDING_PAYMENT}
      AND NOT EXISTS (
        SELECT 1 FROM "InventoryReservation" r
        WHERE r."orderId" = o.id AND r.status = ${RESERVATION.ACTIVE}
      )
  `;
  let orders = 0;
  for (const row of orphans || []) {
    const updated = await tx.order.updateMany({
      where: { id: row.id, status: ORDER.PENDING_PAYMENT },
      data: { status: ORDER.EXPIRED, expiredAt: now },
    });
    orders += updated.count;
  }
  return orders;
}

async function expireOverdueReservations() {
  return prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const overdue = await tx.inventoryReservation.findMany({
        where: { status: RESERVATION.ACTIVE, expiresAt: { lte: now } },
        select: { productId: true },
      });
      let result = { reservations: 0, orders: 0 };
      if (overdue.length) {
        const productIds = [...new Set(overdue.map((r) => r.productId))].sort();
        await lockProducts(tx, productIds);
        result = await expireOverdueForProducts(tx, productIds, now);
      }
      result.orders += await expirePendingWithoutActive(tx, now);
      return result;
    },
    { timeout: 20000 }
  );
}

async function decorateProducts(rows, tx = prisma) {
  if (!rows || !rows.length) return [];
  const reserved = await reservedQtyMap(
    tx,
    rows.map((r) => r && r.id)
  );
  return rows.map((r) => mapProduct(r, reserved.get(r.id) || 0));
}

function startReservationSweeper() {
  const runtime = require("../runtime");
  const tick = () => {
    if (runtime.isDraining()) return;
    if (!runtime.beginSweep()) return;
    expireOverdueReservations()
      .then(() => runtime.endSweep(true))
      .catch((err) => {
        runtime.endSweep(false);
        logError("reservation-sweeper", err);
      });
  };
  tick();
  const handle = setInterval(tick, 60 * 1000);
  if (typeof handle.unref === "function") handle.unref();
  return () => {
    clearInterval(handle);
  };
}

module.exports = {
  RESERVATION,
  ORDER,
  reservationWindowMs,
  reservationExpiresAt,
  availableFrom,
  lockProducts,
  lockOrder,
  reservedQtyMap,
  expireOverdueForProducts,
  expireOverdueReservations,
  decorateProducts,
  startReservationSweeper,
};
