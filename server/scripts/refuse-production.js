"use strict";

if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") {
  console.error("Refusing: this command is not allowed when NODE_ENV=production. Use prisma migrate deploy only.");
  process.exit(1);
}
