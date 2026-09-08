"use strict";

const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const { config } = require("../config");
const { badRequest, conflict, notFound, unauthorized, serviceUnavailable, HttpError } = require("../utils/errors");
const inventory = require("./inventoryService");
const orderService = require("./orderService");
const stripeService = require("./stripeService");

const { ORDER, RESERVATION } = inventory;

function toCents(value) {
  const d = new Prisma.Decimal(value);
  if (d.lessThan(0)) throw conflict("Invalid order total");
  const cents = d.mul(100);
  const asInt = cents.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_EVEN);
  if (!cents.equals(asInt)) throw conflict("Invalid order total");
  const n = Number(asInt.toFixed(0));
  if (!Number.isSafeInteger(n)) throw conflict("Invalid order total");
  return n;
}

function publicOrigin(req) {
  if (config.publicOrigin) return config.publicOrigin;
  const host = String((req.get("host") || "").split(",")[0] || "").trim();
  const proto = String((req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0] || "").trim();
  if (!host || host.length > 253 || /[\s/@\\]/.test(host)) throw badRequest("Invalid request");
  if (proto !== "http" && proto !== "https") throw badRequest("Invalid request");
  return proto + "://" + host;
}

function extractOrderId(event) {
  const obj = event && event.data && event.data.object;
  if (!obj || typeof obj !== "object") return null;
  if (obj.metadata && typeof obj.metadata.orderId === "string") return obj.metadata.orderId;
  if (typeof obj.client_reference_id === "string") return obj.client_reference_id;
  return null;
}

async function createCheckoutSession({ userId, guestToken, orderId, origin }) {
  if (!stripeService.isConfigured()) throw serviceUnavailable();
  if (typeof origin !== "string" || !/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin)) {
    throw badRequest("Invalid request");
  }
  if (typeof orderId !== "string" || !/^NX-\d+$/.test(orderId)) {
    if (!userId && !guestToken) throw unauthorized("Sign in required");
    throw notFound("Not found");
  }

  const prepared = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { orderBy: { id: "asc" } }, reservations: true },
      });
      if (!existing) {
        if (!userId && !guestToken) throw unauthorized("Sign in required");
        throw notFound("Not found");
      }

      const productIds = [...new Set(existing.items.map((i) => i.productId))].sort();
      await inventory.lockProducts(tx, productIds);
      await inventory.lockOrder(tx, existing.id);

      const now = new Date();
      await inventory.expireOverdueForProducts(tx, productIds, now);

      const order = await tx.order.findUnique({
        where: { id: existing.id },
        include: { items: { orderBy: { id: "asc" } }, reservations: true },
      });
      orderService.assertOrderAccess(order, { userId, guestToken });

      if (order.status === ORDER.PAID) throw conflict("Order is already paid");
      if (order.status !== ORDER.PENDING_PAYMENT) throw conflict("Order is not awaiting payment");
      if (order.expiresAt && order.expiresAt.getTime() <= now.getTime()) {
        throw conflict("Reservation is no longer available");
      }

      const reservations = order.reservations || [];
      const active = reservations.filter((r) => r.status === RESERVATION.ACTIVE && r.expiresAt > now);
      if (!reservations.length || active.length !== reservations.length) {
        throw conflict("Reservation is no longer available");
      }

      const currency = String(order.currency || config.stripeCurrency || "usd").toLowerCase();
      if (currency !== config.stripeCurrency) throw conflict("Currency mismatch");

      let sumCents = 0;
      const line_items = order.items.map((item) => {
        const unit = toCents(item.unitPrice);
        sumCents += unit * item.qty;
        const name = String(item.name || "Item").slice(0, 120);
        const finish = String(item.finish || "").slice(0, 40);
        return {
          quantity: item.qty,
          price_data: {
            currency,
            unit_amount: unit,
            product_data: { name: finish ? name + " · " + finish : name },
          },
        };
      });
      const shippingCents = toCents(order.shipping);
      if (shippingCents > 0) {
        line_items.push({
          quantity: 1,
          price_data: {
            currency,
            unit_amount: shippingCents,
            product_data: { name: "Shipping" },
          },
        });
        sumCents += shippingCents;
      }
      const totalCents = toCents(order.total);
      if (sumCents !== totalCents) throw conflict("Order total mismatch");
      if (totalCents < 1) throw conflict("Invalid order total");

      return {
        orderId: order.id,
        email: order.email,
        expiresAt: order.expiresAt,
        currency,
        line_items,
        totalCents,
        existingSessionId: order.stripeCheckoutSessionId,
      };
    },
    { timeout: 15000 }
  );

  const stripe = stripeService.getClient();
  if (!stripe) throw serviceUnavailable();

  if (prepared.existingSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(prepared.existingSessionId);
      if (
        existing &&
        existing.status === "open" &&
        existing.url &&
        existing.payment_status !== "paid" &&
        Number(existing.amount_total) === prepared.totalCents
      ) {
        return {
          url: existing.url,
          sessionId: existing.id,
          orderId: prepared.orderId,
          expiresAt: prepared.expiresAt ? prepared.expiresAt.toISOString() : null,
        };
      }
    } catch (_err) {
      /* create a new session */
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: prepared.email,
    client_reference_id: prepared.orderId,
    line_items: prepared.line_items,
    metadata: { orderId: prepared.orderId },
    success_url:
      prepared && origin
        ? `${origin}/?checkout_return=1&order=${encodeURIComponent(prepared.orderId)}&session_id={CHECKOUT_SESSION_ID}`
        : undefined,
    cancel_url: `${origin}/?checkout_cancel=1&order=${encodeURIComponent(prepared.orderId)}`,
  });

  if (!session || !session.url || !session.id) throw serviceUnavailable();

  await prisma.order.update({
    where: { id: prepared.orderId },
    data: {
      stripeCheckoutSessionId: session.id,
      paymentProvider: "stripe",
    },
  });

  return {
    url: session.url,
    sessionId: session.id,
    orderId: prepared.orderId,
    expiresAt: prepared.expiresAt ? prepared.expiresAt.toISOString() : null,
  };
}

async function fulfillCheckoutSession(event) {
  const session = event && event.data && event.data.object;
  if (!session || typeof session !== "object") throw badRequest("Malformed event");

  const paymentStatus = session.payment_status;
  if (paymentStatus && paymentStatus !== "paid") {
    throw conflict("Payment is not complete");
  }

  const orderId = extractOrderId(event);
  if (!orderId || !/^NX-\d+$/.test(orderId)) throw notFound("Not found");

  const amountTotal = Number(session.amount_total);
  const currency = String(session.currency || "").toLowerCase();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw notFound("Not found");

  if (order.status === ORDER.PLACED || order.status === ORDER.DISPATCHED || order.status === ORDER.CANCELLED) {
    throw conflict("Order is not awaiting payment");
  }

  if (order.status === ORDER.PAID) {
    await orderService.confirmPaidOrder(orderId, {
      provider: "stripe",
      reference: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
      paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      checkoutSessionId: typeof session.id === "string" ? session.id : null,
    });
    return { alreadyPaid: true };
  }

  if (currency !== String(order.currency || config.stripeCurrency).toLowerCase()) {
    throw conflict("Currency mismatch");
  }
  const expected = toCents(order.total);
  if (!Number.isFinite(amountTotal) || amountTotal !== expected) {
    throw conflict("Amount mismatch");
  }

  return orderService.confirmPaidOrder(orderId, {
    provider: "stripe",
    reference: typeof session.payment_intent === "string" ? session.payment_intent : session.id,
    paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
    checkoutSessionId: typeof session.id === "string" ? session.id : null,
  });
}

async function processWebhook(rawBody, signature) {
  if (!stripeService.isConfigured() || !config.stripeWebhookSecret) throw serviceUnavailable();
  if (!signature || typeof signature !== "string") throw badRequest("Invalid signature");

  let event;
  try {
    event = stripeService.constructEvent(rawBody, signature);
  } catch (_err) {
    throw badRequest("Invalid signature");
  }
  if (!event || typeof event.type !== "string" || typeof event.id !== "string") {
    throw badRequest("Malformed event");
  }

  const type = event.type;
  const interesting = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "payment_intent.payment_failed",
  ]);
  if (!interesting.has(type)) {
    return { received: true, ignored: true };
  }

  const orderId = extractOrderId(event);
  try {
    await prisma.stripeEvent.create({
      data: { id: event.id, type, orderId: orderId || null },
    });
  } catch (err) {
    if (err && err.code === "P2002") return { received: true, duplicate: true };
    throw err;
  }

  try {
    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      await fulfillCheckoutSession(event);
    }
  } catch (err) {
    if (err instanceof HttpError && (err.status === 409 || err.status === 404)) {
      return { received: true, declined: true };
    }
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    throw err;
  }
  return { received: true };
}

module.exports = {
  toCents,
  publicOrigin,
  createCheckoutSession,
  processWebhook,
  fulfillCheckoutSession,
};
