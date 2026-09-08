"use strict";

const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const inventory = require("./inventoryService");

const { ORDER } = inventory;

function money(value) {
  if (value == null) return 0;
  return Number(new Prisma.Decimal(value).toFixed(2));
}

async function getStats() {
  const paidStatuses = [ORDER.PAID, ORDER.DISPATCHED];

  const [
    productTotal,
    productActive,
    customerTotal,
    adminTotal,
    orderGroups,
    revenueAgg,
    placedCount,
    pendingCount,
    lowStock,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.user.count({ where: { role: "admin" } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { status: { in: paidStatuses } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.order.count({ where: { status: ORDER.PLACED } }),
    prisma.order.count({ where: { status: ORDER.PENDING_PAYMENT } }),
    prisma.product.count({ where: { isActive: true, stock: { lte: 3 } } }),
  ]);

  const byStatus = {};
  for (const row of orderGroups) byStatus[row.status] = row._count._all;

  return {
    products: { total: productTotal, active: productActive, archived: productTotal - productActive, lowStock },
    customers: { total: customerTotal + adminTotal, customers: customerTotal, admins: adminTotal },
    orders: {
      byStatus,
      pendingPayment: pendingCount,
      placed: placedCount,
      paid: byStatus[ORDER.PAID] || 0,
      dispatched: byStatus[ORDER.DISPATCHED] || 0,
    },
    revenue: {
      paidOrderCount: revenueAgg._count || 0,
      total: money(revenueAgg._sum.total),
      currency: "usd",
      includes: paidStatuses,
      excludes: [ORDER.PLACED, ORDER.PENDING_PAYMENT, ORDER.CANCELLED, ORDER.EXPIRED],
    },
  };
}

module.exports = { getStats };
