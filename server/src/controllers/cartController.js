"use strict";

const cartService = require("../services/cartService");
const { cookieOptions } = require("../utils/cookies");

const COOKIE = "cart_token";
const COOKIE_OPTS = cookieOptions({ maxAge: 180 * 24 * 60 * 60 * 1000 });

function issueCookie(res, token) {
  if (token) res.cookie(COOKIE, token, COOKIE_OPTS);
}

async function withCart(req, res) {
  if (req.user) {
    return cartService.getOrCreateUserCart(req.user.id);
  }
  const { cart, issuedToken } = await cartService.getOrCreateCart(req.cookies[COOKIE]);
  issueCookie(res, issuedToken);
  return cart;
}

async function get(req, res) {
  const cart = await withCart(req, res);
  res.json(await cartService.getSerialized(cart.id));
}

async function add(req, res) {
  const cart = await withCart(req, res);
  await cartService.addItem(cart.id, req.body || {});
  res.status(201).json(await cartService.getSerialized(cart.id));
}

async function patch(req, res) {
  const cart = await withCart(req, res);
  await cartService.setItemQty(cart.id, req.body || {});
  res.json(await cartService.getSerialized(cart.id));
}

async function remove(req, res) {
  const cart = await withCart(req, res);
  await cartService.removeItem(cart.id, req.params.productId, req.params.finish);
  res.json(await cartService.getSerialized(cart.id));
}

module.exports = { get, add, patch, remove };
