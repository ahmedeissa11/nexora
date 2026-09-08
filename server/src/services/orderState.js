"use strict";

const { conflict } = require("../utils/errors");

const ORDER = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  DISPATCHED: "dispatched",
  PLACED: "placed",
};

const IDEMPOTENT = new Set([ORDER.PAID, ORDER.CANCELLED, ORDER.DISPATCHED]);

const LEGAL = {
  [ORDER.PENDING_PAYMENT]: new Set([ORDER.PAID, ORDER.CANCELLED, ORDER.EXPIRED]),
  [ORDER.PAID]: new Set([ORDER.DISPATCHED]),
  [ORDER.CANCELLED]: new Set(),
  [ORDER.EXPIRED]: new Set(),
  [ORDER.DISPATCHED]: new Set(),
  [ORDER.PLACED]: new Set(),
};

function canTransition(from, to) {
  if (from === to && IDEMPOTENT.has(from)) return true;
  const allowed = LEGAL[from];
  return Boolean(allowed && allowed.has(to));
}

function assertTransition(from, to) {
  if (from === to && IDEMPOTENT.has(from)) return { idempotent: true };
  if (!canTransition(from, to)) {
    if (to === ORDER.PAID) throw conflict("Order is not awaiting payment");
    if (to === ORDER.DISPATCHED) throw conflict("Order cannot be dispatched");
    if (to === ORDER.CANCELLED) throw conflict("Order cannot be cancelled");
    throw conflict("Order cannot change status");
  }
  return { idempotent: false };
}

module.exports = { ORDER, LEGAL, canTransition, assertTransition };
