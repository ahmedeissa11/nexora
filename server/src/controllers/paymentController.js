"use strict";

const paymentService = require("../services/paymentService");
const runtime = require("../runtime");
const { serviceUnavailable } = require("../utils/errors");

async function createCheckoutSession(req, res) {
  const userId = req.user ? req.user.id : null;
  const guestToken = req.cookies && req.cookies.nexora_oid;
  const origin = paymentService.publicOrigin(req);
  const result = await paymentService.createCheckoutSession({
    userId,
    guestToken,
    orderId: req.params.id,
    origin,
  });
  res.json(result);
}

async function webhook(req, res) {
  if (runtime.isDraining()) throw serviceUnavailable("Service unavailable");
  const signature = req.get("stripe-signature");
  try {
    const result = await paymentService.processWebhook(req.body, signature);
    if (result && result.duplicate) runtime.inc("webhookDuplicate");
    else runtime.inc("webhookOk");
    res.json({ received: true, duplicate: Boolean(result && result.duplicate) });
  } catch (err) {
    runtime.inc("webhookFail");
    throw err;
  }
}

module.exports = { createCheckoutSession, webhook };
