"use strict";

const sessionService = require("../services/sessionService");
const { unauthorized } = require("../utils/errors");
const { clearCookieOptions } = require("../utils/cookies");

const COOKIE = sessionService.COOKIE;
const COOKIE_CLEAR = clearCookieOptions();

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, COOKIE_CLEAR);
}

async function attachUser(req, res, next) {
  const raw = req.cookies && req.cookies[COOKIE];
  if (!raw) return next();
  try {
    const resolved = await sessionService.resolve(raw);
    if (!resolved) {
      clearSessionCookie(res);
      return next();
    }
    req.user = resolved.user;
    req.sessionId = resolved.sessionId;
  } catch (err) {
    clearSessionCookie(res);
  }
  return next();
}

function requireUser(req) {
  if (!req.user) throw unauthorized("Sign in required");
  return req.user;
}

module.exports = { attachUser, requireUser, clearSessionCookie, COOKIE };
