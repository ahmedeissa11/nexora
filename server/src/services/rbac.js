"use strict";

const ROLES = Object.freeze({
  CUSTOMER: "customer",
  ADMIN: "admin",
});

const ADMIN_CAPABILITIES = Object.freeze({
  products: Object.freeze(["view", "create", "update", "inventory", "activate"]),
  orders: Object.freeze(["view", "inspect", "lifecycle"]),
  customers: Object.freeze(["view", "inspect", "role"]),
  content: Object.freeze(["articles", "drops", "deals"]),
  dashboard: Object.freeze(["stats"]),
});

function normalizeRole(role) {
  return role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.CUSTOMER;
}

function isAdminRole(role) {
  return role === ROLES.ADMIN;
}

module.exports = { ROLES, ADMIN_CAPABILITIES, normalizeRole, isAdminRole };
