"use strict";

/**
 * Server-side one-time operator tool. Promotes an EXISTING user to admin.
 * Does not create accounts. Does not print secrets.
 *
 *   node scripts/promote-admin.js ops@example.com
 */
const { prisma } = require("../src/db/prisma");
const adminService = require("../src/services/adminService");

(async () => {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Usage: node scripts/promote-admin.js email@domain");
    process.exit(1);
  }
  try {
    const result = await adminService.promoteExistingUser(email, {
      actorId: null,
      via: "cli",
    });
    console.log(result.alreadyAdmin ? "already admin" : "promoted");
  } catch (err) {
    console.error(err && err.message ? err.message : "failed");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
