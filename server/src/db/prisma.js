"use strict";

const { PrismaClient } = require("@prisma/client");
const { logError } = require("../utils/log");

const prisma = new PrismaClient({
  log: [{ emit: "event", level: "error" }],
});

prisma.$on("error", (event) => {
  const msg = event && event.message ? String(event.message) : "error";
  if (/Unique constraint failed/i.test(msg)) return;
  logError("prisma", { message: msg });
});

async function pingDatabase() {
  const timeoutMs = 8000;
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("database ping timeout")), timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = { prisma, pingDatabase };
