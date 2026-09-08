"use strict";

/**
 * READ-ONLY invariant scan. Never writes. Never prints secrets.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function issue(list, name, rows) {
  const n = Array.isArray(rows) ? rows.length : Number(rows) || 0;
  list.push({ name, count: n, ok: n === 0 });
  console.log(n === 0 ? "PASS" : "FAIL", name, n === 0 ? "" : String(n));
}

(async () => {
  const findings = [];
  try {
    const negative = await prisma.product.count({ where: { stock: { lt: 0 } } });
    issue(findings, "negative stock", negative);

    const activeOnTerminal = await prisma.$queryRaw`
      SELECT r.id
      FROM "InventoryReservation" r
      JOIN "Order" o ON o.id = r."orderId"
      WHERE r.status = 'active'
        AND o.status IN ('cancelled', 'expired', 'dispatched', 'placed', 'paid')
      LIMIT 50
    `;
    issue(findings, "active reservation on terminal order", activeOnTerminal);

    const consumedOnUnpaid = await prisma.$queryRaw`
      SELECT r.id
      FROM "InventoryReservation" r
      JOIN "Order" o ON o.id = r."orderId"
      WHERE r.status = 'consumed'
        AND o.status IN ('pending_payment', 'cancelled', 'expired')
      LIMIT 50
    `;
    issue(findings, "consumed reservation on unpaid order", consumedOnUnpaid);

    const paidNoPaidAt = await prisma.order.count({
      where: { status: "paid", paidAt: null },
    });
    issue(findings, "paid order missing paidAt", paidNoPaidAt);

    const stripePaidMissing = await prisma.order.count({
      where: {
        status: { in: ["paid", "dispatched"] },
        paymentProvider: "stripe",
        OR: [{ paymentReference: null }, { stripeCheckoutSessionId: null }],
      },
    });
    issue(findings, "stripe paid missing payment metadata", stripePaidMissing);

    const adjMismatch = await prisma.$queryRaw`
      SELECT id FROM "InventoryAdjustment"
      WHERE "resultingStock" <> ("previousStock" + delta)
      LIMIT 50
    `;
    issue(findings, "inventory adjustment math mismatch", adjMismatch);

    const orphanResProduct = await prisma.$queryRaw`
      SELECT r.id FROM "InventoryReservation" r
      LEFT JOIN "Product" p ON p.id = r."productId"
      WHERE p.id IS NULL
      LIMIT 20
    `;
    issue(findings, "reservation missing product", orphanResProduct);

    const orphanResOrder = await prisma.$queryRaw`
      SELECT r.id FROM "InventoryReservation" r
      LEFT JOIN "Order" o ON o.id = r."orderId"
      WHERE o.id IS NULL
      LIMIT 20
    `;
    issue(findings, "reservation missing order", orphanResOrder);

    const pendingWithoutActive = await prisma.$queryRaw`
      SELECT o.id FROM "Order" o
      WHERE o.status = 'pending_payment'
        AND NOT EXISTS (
          SELECT 1 FROM "InventoryReservation" r
          WHERE r."orderId" = o.id AND r.status = 'active'
        )
      LIMIT 50
    `;
    issue(findings, "pending_payment without active reservation", pendingWithoutActive);

    const invalidRoles = await prisma.$queryRaw`
      SELECT id FROM "User" WHERE role NOT IN ('customer', 'admin') LIMIT 50
    `;
    issue(findings, "invalid user role", invalidRoles);

    const invalidOrderStatus = await prisma.$queryRaw`
      SELECT id FROM "Order"
      WHERE status NOT IN ('pending_payment','paid','cancelled','expired','dispatched','placed')
      LIMIT 50
    `;
    issue(findings, "invalid order status", invalidOrderStatus);

    const invalidResStatus = await prisma.$queryRaw`
      SELECT id FROM "InventoryReservation"
      WHERE status NOT IN ('active','released','consumed','expired')
      LIMIT 50
    `;
    issue(findings, "invalid reservation status", invalidResStatus);

    const qtyBad = await prisma.$queryRaw`
      SELECT id FROM "OrderItem" WHERE qty < 1
      UNION ALL
      SELECT id FROM "CartItem" WHERE qty < 1
      UNION ALL
      SELECT id FROM "InventoryReservation" WHERE qty < 1
      LIMIT 50
    `;
    issue(findings, "non-positive qty", qtyBad);

    const paidBeforeCreated = await prisma.$queryRaw`
      SELECT id FROM "Order" WHERE "paidAt" IS NOT NULL AND "paidAt" < "createdAt" LIMIT 50
    `;
    issue(findings, "paidAt before createdAt", paidBeforeCreated);

    const duplicateReservations = await prisma.$queryRaw`
      SELECT "orderId" FROM "InventoryReservation"
      GROUP BY "orderId", "productId"
      HAVING count(*) > 1
      LIMIT 50
    `;
    issue(findings, "duplicate reservation per order+product", duplicateReservations);

    const orphanOrderItemProduct = await prisma.$queryRaw`
      SELECT i.id FROM "OrderItem" i
      LEFT JOIN "Product" p ON p.id = i."productId"
      WHERE p.id IS NULL
      LIMIT 20
    `;
    issue(findings, "order item missing product", orphanOrderItemProduct);

    const orphanCartItemProduct = await prisma.$queryRaw`
      SELECT i.id FROM "CartItem" i
      LEFT JOIN "Product" p ON p.id = i."productId"
      WHERE p.id IS NULL
      LIMIT 20
    `;
    issue(findings, "cart item missing product", orphanCartItemProduct);

    const summary = {
      ok: findings.every((f) => f.ok),
      checks: findings.length,
      failed: findings.filter((f) => !f.ok).map((f) => f.name),
      readOnly: true,
    };
    console.log("\n==== INTEGRITY " + (summary.ok ? "OK" : "ISSUES") + " ====");
    console.log(JSON.stringify(summary));
    process.exit(summary.ok ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
})().catch(() => {
  console.error("integrity-check failed");
  process.exit(1);
});
