"use strict";

const bcrypt = require("bcrypt");
const { prisma } = require("../db/prisma");
const { config } = require("../config");
const { badRequest, unauthorized } = require("../utils/errors");
const { assertEmail } = require("../utils/validate");
const { publicUser } = require("./sessionService");
const { adminClient, anonClient } = require("./supabase");

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = bcrypt.hashSync("nexora-timing-dummy", BCRYPT_ROUNDS);
const GENERIC_AUTH = "Invalid email or password";

function assertPassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 200) {
    throw badRequest("Password must be at least 8 characters");
  }
  return value;
}

function readCredentials(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("Invalid email");
  const email = assertEmail(body.email);
  const password = assertPassword(body.password);
  return { email, password };
}

function displayName(email) {
  return email.split("@")[0];
}

async function provisionSupabaseUser(email, password) {
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: displayName(email) },
  });
  if (!created.error && created.data && created.data.user) {
    return created.data.user;
  }
  const anon = anonClient();
  const signed = await anon.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data || !signed.data.user) {
    throw unauthorized(GENERIC_AUTH);
  }
  return signed.data.user;
}

async function ensureAppUser(email, authId) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const taken = await prisma.user.findUnique({ where: { authId } });
    if (taken) throw unauthorized(GENERIC_AUTH);
    return prisma.user.create({
      data: {
        email,
        authId,
        name: displayName(email),
        role: "customer",
      },
    });
  }
  if (existing.authId && existing.authId !== authId) throw unauthorized(GENERIC_AUTH);
  if (existing.authId === authId && !existing.passwordHash) return existing;
  return prisma.user.update({
    where: { id: existing.id },
    data: {
      authId,
      passwordHash: null,
    },
  });
}

async function registerWithSupabase(email, password) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await anonClient()
      .auth.signInWithPassword({ email, password })
      .catch(() => {});
    throw unauthorized(GENERIC_AUTH);
  }
  let authUser;
  try {
    authUser = await provisionSupabaseUser(email, password);
  } catch (err) {
    if (err && err.status === 401) throw err;
    throw unauthorized(GENERIC_AUTH);
  }
  try {
    const user = await prisma.user.create({
      data: {
        email,
        authId: authUser.id,
        name: displayName(email),
        role: "customer",
      },
    });
    return publicUser(user);
  } catch (err) {
    if (err && err.code === "P2002") throw unauthorized(GENERIC_AUTH);
    throw err;
  }
}

async function loginWithSupabase(email, password) {
  const appUser = await prisma.user.findUnique({ where: { email } });

  if (appUser && appUser.passwordHash && !appUser.authId) {
    const ok = await bcrypt.compare(password, appUser.passwordHash);
    if (!ok) throw unauthorized(GENERIC_AUTH);
    const authUser = await provisionSupabaseUser(email, password);
    const updated = await prisma.user.update({
      where: { id: appUser.id },
      data: { authId: authUser.id, passwordHash: null },
    });
    return publicUser(updated);
  }

  const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
  if (error || !data || !data.user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw unauthorized(GENERIC_AUTH);
  }

  const user = await ensureAppUser(email, data.user.id);
  return publicUser(user);
}

async function registerLocal(email, password) {
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  if (existing) throw unauthorized(GENERIC_AUTH);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: displayName(email),
        role: "customer",
      },
    });
    return publicUser(user);
  } catch (err) {
    if (err && err.code === "P2002") throw unauthorized(GENERIC_AUTH);
    throw err;
  }
}

async function loginLocal(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  const hash = user && user.passwordHash ? user.passwordHash : DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) throw unauthorized(GENERIC_AUTH);
  return publicUser(user);
}

async function register(body) {
  const { email, password } = readCredentials(body);
  if (config.supabaseConfigured) return registerWithSupabase(email, password);
  return registerLocal(email, password);
}

async function login(body) {
  const { email, password } = readCredentials(body);
  if (config.supabaseConfigured) return loginWithSupabase(email, password);
  return loginLocal(email, password);
}

module.exports = { register, login, readCredentials, GENERIC_AUTH };
