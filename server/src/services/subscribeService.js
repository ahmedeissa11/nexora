"use strict";

const { prisma } = require("../db/prisma");
const { assertEmail } = require("../utils/validate");

async function subscribe(body) {
  const email = assertEmail(body && body.email);
  try {
    await prisma.subscriber.create({ data: { email } });
  } catch (err) {
    if (!(err && err.code === "P2002")) throw err;
  }
  return { ok: true };
}

module.exports = { subscribe };
