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
  await prisma.$queryRaw`SELECT 1`;
}

module.exports = { prisma, pingDatabase };
