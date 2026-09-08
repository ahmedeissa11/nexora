"use strict";

const authService = require("../services/authService");
const sessionService = require("../services/sessionService");
const cartService = require("../services/cartService");
const { requireUser, clearSessionCookie, COOKIE } = require("../middleware/auth");
const { clearCookieOptions } = require("../utils/cookies");

const CART_COOKIE = "cart_token";
const CART_CLEAR = clearCookieOptions();

async function establish(req, res, user, status) {
  const guestToken = req.cookies && req.cookies[CART_COOKIE];
  await cartService.mergeGuestIntoUser(guestToken, user.id);
  const { raw } = await sessionService.createSession(user.id);
  sessionService.issueCookie(res, raw);
  res.clearCookie(CART_COOKIE, CART_CLEAR);
  res.status(status).json({ user });
}

async function register(req, res) {
  const user = await authService.register(req.body || {});
  await establish(req, res, user, 201);
}

async function login(req, res) {
  const user = await authService.login(req.body || {});
  await establish(req, res, user, 200);
}

async function logout(req, res) {
  const raw = req.cookies && req.cookies[COOKIE];
  await sessionService.destroy(raw);
  clearSessionCookie(res);
  res.json({ ok: true });
}

async function me(req, res) {
  const user = requireUser(req);
  const { prisma } = require("../db/prisma");
  const { publicUser } = require("../services/sessionService");
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Sign in required" });
  }
  res.json({ user: publicUser(row) });
}

module.exports = { register, login, logout, me };
