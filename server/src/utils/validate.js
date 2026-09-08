"use strict";

const { badRequest } = require("./errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

function assertEmail(value, field = "email") {
  if (typeof value !== "string" || !EMAIL_RE.test(value.trim())) {
    throw badRequest(`Invalid ${field}`);
  }
  return value.trim().toLowerCase();
}

function assertProductId(value) {
  if (typeof value !== "string" || !ID_RE.test(value)) {
    throw badRequest("Invalid product id");
  }
  return value;
}

function assertQty(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw badRequest("quantity must be an integer greater than 0");
  }
  return n;
}

function assertString(value, field, { min = 1, max = 500 } = {}) {
  if (typeof value !== "string") throw badRequest(`Invalid ${field}`);
  const v = value.trim();
  if (v.length < min || v.length > max) {
    throw badRequest(`Invalid ${field}`);
  }
  return v;
}

function assertSearchQuery(q) {
  if (typeof q !== "string") throw badRequest("Invalid search query");
  const v = q.trim();
  if (v.length < 1 || v.length > 120) throw badRequest("Invalid search query");
  return escapeLike(v);
}

function escapeLike(term) {
  return String(term).replace(/[%_\\]/g, "");
}

function assertEnum(value, field, allowed) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw badRequest(`Invalid ${field}`);
  }
  return value;
}

function pickFields(body, keys) {
  const out = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) return out;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

function assertOrderId(value) {
  if (typeof value !== "string" || !/^NX-\d+$/.test(value)) {
    throw badRequest("Invalid id");
  }
  return value;
}

module.exports = {
  assertEmail,
  assertProductId,
  assertQty,
  assertString,
  assertSearchQuery,
  escapeLike,
  assertEnum,
  pickFields,
  assertOrderId,
};
