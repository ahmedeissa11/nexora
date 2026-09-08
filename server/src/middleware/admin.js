"use strict";

const { prisma } = require("../db/prisma");
const { unauthorized, forbidden } = require("../utils/errors");
const { isAdminRole, normalizeRole } = require("../services/rbac");

function requireAdmin(req, res, next) {
  Promise.resolve()
    .then(async () => {
      if (!req.user || !req.user.id) throw unauthorized("Sign in required");
      const row = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!row) throw unauthorized("Sign in required");
      if (!isAdminRole(row.role)) throw forbidden("Not allowed");
      req.admin = {
        id: row.id,
        email: row.email,
        name: row.name || null,
        role: normalizeRole(row.role),
      };
    })
    .then(() => next())
    .catch(next);
}

module.exports = { requireAdmin };
