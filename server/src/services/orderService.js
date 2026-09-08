"use strict";

const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const { config } = require("../config");
const { badRequest, conflict, notFound, unauthorized } = require("../utils/errors");
const { assertEmail, assertString } = require("../utils/validate");
const { findExistingCart } = require("./cartService");
const inventory = require("./inventoryService");
const { assertTransition } = require("./orderState");

const AVAILABILITY = "Some items are no longer available in the requested quantity";
const EMPTY = "Your cart is empty.";
const MAX_QTY = 99;
const { ORDER, RESERVATION } = inventory;

function dec(value) {
  return new Prisma.Decimal(value);
}

function money(value) {
  return Number(dec(value).toFixed(2));
}

function readCheckout(body) {
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const first = assertString(body.first, "first name", { min: 1, max: 80 });
  const last = assertString(body.last, "last name", { min: 1, max: 80 });
  const email = assertEmail(body.email);
  const address = assertString(body.address, "address", { min: 4, max: 300 });
  return { first, last, email, address };
}

function hashOrderToken(raw) {
  if (!raw || typeof raw !== "string" || raw.length < 16 || raw.length > 128) return null;
  if (raw.startsWith("v1:")) return null;
  return (
    "v1:" + crypto.createHmac("sha256", config.sessionSecret).update("order:" + raw).digest("hex")
  );
}

function newOrderToken() {
  return crypto.randomBytes(32).toString("hex");
}

function assertOrderAccess(order, { userId, guestToken } = {}) {
  if (!order) throw notFound("Not found");
  if (order.userId) {
    if (!userId) throw unauthorized("Sign in required");
    if (order.userId !== userId) throw notFound("Not found");
    return order;
  }
  const hashed = hashOrderToken(guestToken);
  if (hashed && order.guestAccessHash && hashed === order.guestAccessHash) return order;
  if (!userId) throw unauthorized("Sign in required");
  throw notFound("Not found");
}

function serializeOrder(order) {
  const out = {
    id: order.id,
    status: order.status,
    subtotal: money(order.subtotal),
    shipping: money(order.shipping),
    total: money(order.total),
    createdAt: order.createdAt.toISOString(),
    items: (order.items || []).map((item) => ({
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
  if (order.paymentProvider) out.paymentProvider = order.paymentProvider;
  return out;
}

const ORDER_INCLUDE = {
  items: { orderBy: { id: "asc" } },
  reservations: true,
};

async function nextOrderId(tx) {
  const rows = await tx.$queryRaw`SELECT nextval('nexora_order_seq') AS n`;
  const n = Number(rows[0].n);
  if (!Number.isFinite(n) || n < 1) throw new Error("Could not allocate order id");
  return `NX-${String(n).padStart(4, "0")}`;
}

async function placeOrder({ userId, cartToken, body }) {
  const details = readCheckout(body);
  const existing = await findExistingCart(userId, cartToken);
  if (!existing || !existing.items || !existing.items.length) {
    throw badRequest(EMPTY);
  }
  const cartId = existing.id;

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Cart" WHERE id = ${cartId} FOR UPDATE`;
      const cart = await tx.cart.findUnique({
        where: { id: cartId },
        include: { items: { orderBy: { id: "asc" } } },
      });
      if (!cart || !cart.items.length) throw badRequest(EMPTY);

      for (const line of cart.items) {
        if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY) {
          throw conflict(AVAILABILITY);
        }
      }

      const ids = [...new Set(cart.items.map((l) => l.productId))].sort();
      await inventory.lockProducts(tx, ids);

      const now = new Date();
      await inventory.expireOverdueForProducts(tx, ids, now);

      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      const byId = new Map(products.map((p) => [p.id, p]));
      if (products.length !== ids.length) throw conflict(AVAILABILITY);

      const needed = new Map();
      for (const line of cart.items) {
        needed.set(line.productId, (needed.get(line.productId) || 0) + line.qty);
      }

      const reserved = await inventory.reservedQtyMap(tx, ids, now);
      for (const [productId, qty] of needed) {
        const product = byId.get(productId);
        if (!product || product.isActive === false) throw conflict("Some items are no longer available.");
        const available = inventory.availableFrom(product.stock, reserved.get(productId) || 0);
        if (product.stock <= 0 || available <= 0) {
          throw conflict("Some items are no longer available.");
        }
        if (available < qty) throw conflict("Some items have limited availability.");
      }

      let subtotalDec = dec(0);
      const snapshots = cart.items.map((line) => {
        const product = byId.get(line.productId);
        const unit = dec(product.price);
        const lineTotal = unit.mul(line.qty);
        subtotalDec = subtotalDec.plus(lineTotal);
        return {
          productId: product.id,
          name: product.name,
          image: product.image,
          finish: line.finish,
          qty: line.qty,
          unitPrice: unit,
        };
      });

      const shipping = dec(0);
      const totalDec = subtotalDec.plus(shipping);
      const orderId = await nextOrderId(tx);
      const expiresAt = inventory.reservationExpiresAt(now);

      let guestToken = null;
      let guestAccessHash = null;
      if (!userId) {
        guestToken = newOrderToken();
        guestAccessHash = hashOrderToken(guestToken);
      }

      await tx.order.create({
        data: {
          id: orderId,
          userId: userId || null,
          email: details.email,
          firstName: details.first,
          lastName: details.last,
          address: details.address,
          status: ORDER.PENDING_PAYMENT,
          subtotal: subtotalDec,
          shipping,
          total: totalDec,
          expiresAt,
          currency: config.stripeCurrency || "usd",
          guestAccessHash,
          items: { create: snapshots },
        },
      });

      for (const [productId, qty] of needed) {
        await tx.inventoryReservation.create({
          data: {
            orderId,
            productId,
            qty,
            expiresAt,
            status: RESERVATION.ACTIVE,
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });

      return {
        orderId,
        status: ORDER.PENDING_PAYMENT,
        expiresAt: expiresAt.toISOString(),
        subtotal: money(subtotalDec),
        shipping: 0,
        total: money(totalDec),
        guestToken,
      };
    },
    { timeout: 15000 }
  );
}

async function confirmPaidOrder(orderId, extras = {}) {
  if (typeof orderId !== "string" || !/^NX-\d+$/.test(orderId)) {
    throw notFound("Not found");
  }

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: { reservations: true, items: true },
      });
      if (!existing) throw notFound("Not found");
      if (existing.status === ORDER.PAID) {
        return { orderId: existing.id, status: ORDER.PAID, alreadyPaid: true };
      }

      const productIds = [
        ...new Set(
          (existing.reservations.length
            ? existing.reservations
            : existing.items
          ).map((r) => r.productId)
        ),
      ].sort();

      await inventory.lockProducts(tx, productIds);
      await inventory.lockOrder(tx, orderId);

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { reservations: true, items: true },
      });
      if (!order) throw notFound("Not found");
      if (order.status === ORDER.PAID) {
        return { orderId: order.id, status: ORDER.PAID, alreadyPaid: true };
      }
      assertTransition(order.status, ORDER.PAID);

      const now = new Date();
      await inventory.expireOverdueForProducts(tx, productIds, now);

      const reservations = await tx.inventoryReservation.findMany({
        where: { orderId },
      });
      const active = reservations.filter((r) => r.status === RESERVATION.ACTIVE && r.expiresAt > now);
      if (!reservations.length || active.length !== reservations.length) {
        throw conflict("Reservation is no longer available");
      }

      for (const resv of active) {
        const updated = await tx.product.updateMany({
          where: { id: resv.productId, stock: { gte: resv.qty } },
          data: { stock: { decrement: resv.qty } },
        });
        if (updated.count !== 1) throw conflict(AVAILABILITY);
      }

      await tx.inventoryReservation.updateMany({
        where: { orderId, status: RESERVATION.ACTIVE },
        data: { status: RESERVATION.CONSUMED },
      });

      const paidData = { status: ORDER.PAID, paidAt: now };
      if (extras && extras.provider) paidData.paymentProvider = String(extras.provider).slice(0, 32);
      if (extras && extras.reference) paidData.paymentReference = String(extras.reference).slice(0, 191);
      if (extras && extras.paymentIntentId) {
        paidData.stripePaymentIntentId = String(extras.paymentIntentId).slice(0, 191);
      }
      if (extras && extras.checkoutSessionId) {
        paidData.stripeCheckoutSessionId = String(extras.checkoutSessionId).slice(0, 191);
      }

      await tx.order.update({
        where: { id: orderId },
        data: paidData,
      });

      return { orderId, status: ORDER.PAID, alreadyPaid: false };
    },
    { timeout: 15000 }
  );
}

async function cancelOrder(orderId) {
  if (typeof orderId !== "string" || !/^NX-\d+$/.test(orderId)) {
    throw notFound("Not found");
  }

  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: { reservations: true },
      });
      if (!existing) throw notFound("Not found");
      if (existing.status === ORDER.CANCELLED) {
        return { orderId, status: ORDER.CANCELLED };
      }

      const productIds = [...new Set(existing.reservations.map((r) => r.productId))].sort();
      await inventory.lockProducts(tx, productIds);
      await inventory.lockOrder(tx, orderId);

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { reservations: true },
      });
      if (!order) throw notFound("Not found");
      if (order.status === ORDER.CANCELLED) {
        return { orderId, status: ORDER.CANCELLED };
      }

      const now = new Date();

      if (order.status === ORDER.PENDING_PAYMENT) {
        assertTransition(order.status, ORDER.CANCELLED);
        await tx.inventoryReservation.updateMany({
          where: { orderId, status: RESERVATION.ACTIVE },
          data: { status: RESERVATION.RELEASED, releasedAt: now },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: ORDER.CANCELLED, cancelledAt: now },
        });
        return { orderId, status: ORDER.CANCELLED };
      }

      if (order.status === ORDER.PAID || order.status === ORDER.DISPATCHED) {
        await tx.order.update({
          where: { id: orderId },
          data: { cancelRequestedAt: order.cancelRequestedAt || now },
        });
        return { orderId, status: order.status, cancelRequested: true };
      }

      throw conflict("Order cannot be cancelled");
    },
    { timeout: 15000 }
  );
}

async function listForUser(userId) {
  if (!userId) throw unauthorized("Sign in required");
  const orders = await prisma.order.findMany({
    where: { userId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(serializeOrder);
}

async function getForUser(userId, id) {
  if (!userId) throw unauthorized("Sign in required");
  if (typeof id !== "string" || !/^NX-\d+$/.test(id)) throw notFound("Not found");
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw notFound("Not found");
  return serializeOrder(order);
}

async function getForRequester({ userId, guestToken, id }) {
  if (typeof id !== "string" || !/^NX-\d+$/.test(id)) throw notFound("Not found");
  const order = await prisma.order.findUnique({
    where: { id },
    include: ORDER_INCLUDE,
  });
  if (!order) {
    if (!userId && !guestToken) throw unauthorized("Sign in required");
    throw notFound("Not found");
  }
  assertOrderAccess(order, { userId, guestToken });
  return serializeOrder(order);
}


async function dispatchOrder(orderId) {
  if (typeof orderId !== "string" || !/^NX-\d+$/.test(orderId)) {
    throw notFound("Not found");
  }

  return prisma.$transaction(
    async (tx) => {
      await inventory.lockOrder(tx, orderId);
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw notFound("Not found");
      if (order.status === ORDER.DISPATCHED) {
        return { orderId, status: ORDER.DISPATCHED, alreadyDispatched: true };
      }
      if (order.status !== ORDER.PAID) {
        throw conflict("Order cannot be dispatched");
      }
      const now = new Date();
      await tx.order.update({
        where: { id: orderId },
        data: { status: ORDER.DISPATCHED, dispatchedAt: now },
      });
      return { orderId, status: ORDER.DISPATCHED, alreadyDispatched: false };
    },
    { timeout: 15000 }
  );
}

module.exports = {
  placeOrder,
  listForUser,
  getForUser,
  getForRequester,
  serializeOrder,
  confirmPaidOrder,
  cancelOrder,
  dispatchOrder,
  assertOrderAccess,
  hashOrderToken,
};
