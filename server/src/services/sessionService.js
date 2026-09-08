"use strict";

const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { config } = require("../config");
const { cookieOptions } = require("../utils/cookies");

const COOKIE = "nexora_sid";
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const COOKIE_OPTS = cookieOptions({ maxAge: SESSION_MS });

function hashToken(raw) {
  return crypto.createHmac("sha256", config.sessionSecret).update(String(raw)).digest("hex");
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: user.role === "admin" ? "admin" : "customer",
  };
}

async function createSession(userId) {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });
  return { raw, expiresAt };
}

async function resolve(raw) {
  if (!raw || typeof raw !== "string" || raw.length < 16 || raw.length > 128) return null;
  const tokenHash = hashToken(raw);
  const row = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  return {
    sessionId: row.id,
    user: publicUser(row.user),
  };
}

async function destroy(raw) {
  if (!raw || typeof raw !== "string") return;
  const tokenHash = hashToken(raw);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

function issueCookie(res, raw) {
  if (!raw) return;
  res.cookie(COOKIE, raw, COOKIE_OPTS);
}

module.exports = {
  COOKIE,
  COOKIE_OPTS,
  SESSION_MS,
  hashToken,
  publicUser,
  createSession,
  resolve,
  destroy,
  issueCookie,
};
