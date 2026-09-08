"use strict";

const crypto = require("crypto");
const Stripe = require("stripe");
const { config } = require("../config");

let injected = null;
let mockSingleton = null;
let liveSingleton = null;
let lastCheckoutParams = null;

function setTestClient(client) {
  injected = client;
}

function getLastCheckoutParams() {
  return lastCheckoutParams;
}

function createMockStripe() {
  const sessions = new Map();
  return {
    checkout: {
      sessions: {
        async create(params) {
          lastCheckoutParams = params;
          const id = "cs_test_" + crypto.randomBytes(8).toString("hex");
          let amount_total = 0;
          for (const li of params.line_items || []) {
            const unit = Number(li.price_data && li.price_data.unit_amount);
            const qty = Number(li.quantity);
            if (!Number.isInteger(unit) || !Number.isInteger(qty) || unit < 0 || qty < 1) {
              throw new Error("Invalid line item");
            }
            amount_total += unit * qty;
          }
          const currency =
            (params.line_items &&
              params.line_items[0] &&
              params.line_items[0].price_data &&
              params.line_items[0].price_data.currency) ||
            "usd";
          const session = {
            id,
            object: "checkout.session",
            url: "https://checkout.stripe.com/c/pay/" + id,
            status: "open",
            payment_status: "unpaid",
            amount_total,
            currency,
            client_reference_id: params.client_reference_id || null,
            metadata: Object.assign({}, params.metadata || {}),
            payment_intent: "pi_test_" + crypto.randomBytes(8).toString("hex"),
            mode: params.mode,
            customer_email: params.customer_email || null,
          };
          sessions.set(id, session);
          return session;
        },
        async retrieve(id) {
          const s = sessions.get(id);
          if (!s) {
            const err = new Error("No such checkout.session");
            err.statusCode = 404;
            throw err;
          }
          return s;
        },
      },
    },
    webhooks: Stripe.webhooks,
  };
}

function isConfigured() {
  if (injected) return true;
  if (config.stripeMock) return true;
  return Boolean(config.stripeSecretKey && config.stripeWebhookSecret);
}

function getClient() {
  if (injected) return injected;
  if (config.stripeMock) {
    if (!mockSingleton) mockSingleton = createMockStripe();
    return mockSingleton;
  }
  if (!config.stripeSecretKey) return null;
  if (!liveSingleton) {
    liveSingleton = new Stripe(config.stripeSecretKey, { timeout: 20000 });
  }
  return liveSingleton;
}

function constructEvent(rawBody, signature) {
  const secret = config.stripeWebhookSecret;
  if (!secret || !signature) {
    throw new Error("Missing webhook secret or signature");
  }
  const client = getClient();
  const webhooks = client && client.webhooks ? client.webhooks : Stripe.webhooks;
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || "");
  return webhooks.constructEvent(payload, signature, secret);
}

function signTestPayload(payload, secret) {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret: secret || config.stripeWebhookSecret,
  });
  return { payload: raw, header };
}

module.exports = {
  setTestClient,
  isConfigured,
  getClient,
  constructEvent,
  signTestPayload,
  getLastCheckoutParams,
  createMockStripe,
};
