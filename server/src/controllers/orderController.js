"use strict";

const orderService = require("../services/orderService");
const { requireUser } = require("../middleware/auth");
const { cookieOptions } = require("../utils/cookies");

const CART_COOKIE = "cart_token";
const ORDER_COOKIE = "nexora_oid";
const ORDER_COOKIE_OPTS = cookieOptions({ maxAge: 7 * 24 * 60 * 60 * 1000 });

async function create(req, res) {
  const userId = req.user ? req.user.id : null;
  const cartToken = req.cookies && req.cookies[CART_COOKIE];
  const result = await orderService.placeOrder({
    userId,
    cartToken,
    body: req.body || {},
  });
  if (result.guestToken) {
    res.cookie(ORDER_COOKIE, result.guestToken, ORDER_COOKIE_OPTS);
    delete result.guestToken;
  }
  res.status(201).json(result);
}

async function list(req, res) {
  const user = requireUser(req);
  res.json(await orderService.listForUser(user.id));
}

async function get(req, res) {
  const userId = req.user ? req.user.id : null;
  const guestToken = req.cookies && req.cookies[ORDER_COOKIE];
  res.json(
    await orderService.getForRequester({
      userId,
      guestToken,
      id: req.params.id,
    })
  );
}

module.exports = { create, list, get };
