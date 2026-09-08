"use strict";

const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const { badRequest, notFound, conflict } = require("../utils/errors");
const { assertProductId, assertString, pickFields, escapeLike } = require("../utils/validate");
const { parsePagination } = require("../utils/pagination");
const inventory = require("./inventoryService");
const audit = require("./auditService");

const CREATE_FIELDS = [
  "id",
  "name",
  "slug",
  "category",
  "collection",
  "type",
  "tag",
  "tagline",
  "price",
  "compareAt",
  "image",
  "meta",
  "blurb",
  "isFeatured",
  "isDrop",
  "isArrival",
  "isActive",
  "specs",
  "stock",
];
const UPDATE_FIELDS = CREATE_FIELDS.filter((k) => k !== "id" && k !== "stock");

function dec(value) {
  return new Prisma.Decimal(value);
}

function money(value) {
  if (value == null) return null;
  return Number(dec(value).toFixed(2));
}

function assertMoney(value, field) {
  let raw = value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw badRequest("Invalid " + field);
    raw = value.toFixed(2);
  }
  let d;
  try {
    d = dec(raw);
  } catch (_err) {
    throw badRequest("Invalid " + field);
  }
  if (d.lte(0) || d.gt(999999.99)) throw badRequest("Invalid " + field);
  const quantized = d.toDecimalPlaces(2);
  if (!d.equals(quantized)) throw badRequest("Invalid " + field);
  return quantized;
}

function assertImagePath(src) {
  if (typeof src !== "string") throw badRequest("Invalid image");
  const s = src.trim();
  if (/^images\/[a-zA-Z0-9._/-]+$/.test(s)) return s;
  if (/^\/images\/[a-zA-Z0-9._/-]+$/.test(s)) return s.slice(1);
  throw badRequest("Invalid image");
}

function assertSlug(value) {
  const s = assertString(value, "slug", { min: 1, max: 80 });
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(s)) throw badRequest("Invalid slug");
  return s;
}

function assertBool(value, field) {
  if (typeof value !== "boolean") throw badRequest("Invalid " + field);
  return value;
}

function parseSpecs(specs) {
  if (specs == null) return null;
  if (!Array.isArray(specs) || specs.length > 20) throw badRequest("Invalid specs");
  return specs.map((pair, i) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw badRequest("Invalid specs");
    return {
      sort: i,
      label: assertString(String(pair[0]), "spec label", { min: 1, max: 80 }),
      value: assertString(String(pair[1]), "spec value", { min: 1, max: 200 }),
    };
  });
}

function serializeAdminProduct(row, reservedQty = 0) {
  const physical = Number(row.stock || 0);
  const reserved = Number(reservedQty || 0);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    collection: row.collection,
    type: row.type,
    tag: row.tag || null,
    tagline: row.tagline || null,
    price: money(row.price),
    compareAt: row.compareAt != null ? money(row.compareAt) : null,
    image: row.image,
    meta: row.meta,
    blurb: row.blurb,
    rating: money(row.rating),
    reviewCount: row.reviewCount,
    physicalStock: physical,
    reservedQty: reserved,
    available: inventory.availableFrom(physical, reserved),
    isActive: row.isActive !== false,
    isFeatured: Boolean(row.isFeatured),
    isDrop: Boolean(row.isDrop),
    isArrival: Boolean(row.isArrival),
    specs: (row.specs || []).map((s) => [s.label, s.value]),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseAdminSort(sort) {
  const key = sort || "name";
  if (key === "name") return [{ name: "asc" }];
  if (key === "price-asc") return [{ price: "asc" }, { name: "asc" }];
  if (key === "price-desc") return [{ price: "desc" }, { name: "asc" }];
  if (key === "created") return [{ createdAt: "desc" }];
  if (key === "stock") return [{ stock: "asc" }, { name: "asc" }];
  throw badRequest("Invalid sort");
}

async function listProducts(query) {
  const { page, perPage, skip } = parsePagination(query || {});
  const orderBy = parseAdminSort(query && query.sort);
  const where = {};
  const active = query && query.active;
  if (active === "true") where.isActive = true;
  else if (active === "false") where.isActive = false;
  if (query && query.category) {
    where.category = assertString(query.category, "category", { min: 1, max: 80 });
  }
  const rawQ = typeof (query && query.q) === "string" ? query.q.trim() : "";
  if (rawQ.length > 120) throw badRequest("Invalid search query");
  const q = rawQ ? escapeLike(rawQ) : "";
  if (rawQ && !q) return { products: [], total: 0, page, perPage };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { id: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { specs: { orderBy: { sort: "asc" } } },
      orderBy,
      skip,
      take: perPage,
    }),
  ]);
  const reserved = await inventory.reservedQtyMap(
    prisma,
    rows.map((r) => r.id)
  );
  return {
    products: rows.map((r) => serializeAdminProduct(r, reserved.get(r.id) || 0)),
    total,
    page,
    perPage,
  };
}

async function getProduct(id) {
  const pid = assertProductId(id);
  const row = await prisma.product.findUnique({
    where: { id: pid },
    include: { specs: { orderBy: { sort: "asc" } } },
  });
  if (!row) throw notFound("Not found");
  const reserved = await inventory.reservedQtyMap(prisma, [pid]);
  return serializeAdminProduct(row, reserved.get(pid) || 0);
}

function readProductFields(body, keys, { creating }) {
  const src = pickFields(body, keys);
  const data = {};
  if (creating) {
    data.id = assertProductId(src.id);
    data.slug = src.slug != null ? assertSlug(src.slug) : data.id;
  } else if (src.slug != null) {
    data.slug = assertSlug(src.slug);
  }
  if (creating || src.name != null) data.name = assertString(src.name, "name", { min: 1, max: 120 });
  if (creating || src.category != null) data.category = assertString(src.category, "category", { min: 1, max: 80 });
  if (creating || src.collection != null) {
    data.collection = assertString(src.collection, "collection", { min: 1, max: 80 });
  }
  if (creating || src.type != null) data.type = assertString(src.type, "type", { min: 1, max: 80 });
  if (src.tag !== undefined) data.tag = src.tag == null || src.tag === "" ? null : assertString(src.tag, "tag", { min: 1, max: 80 });
  if (src.tagline !== undefined) {
    data.tagline =
      src.tagline == null || src.tagline === "" ? null : assertString(src.tagline, "tagline", { min: 1, max: 200 });
  }
  if (creating || src.price != null) data.price = assertMoney(src.price, "price");
  if (src.compareAt !== undefined) {
    data.compareAt = src.compareAt == null || src.compareAt === "" ? null : assertMoney(src.compareAt, "compareAt");
  }
  if (creating || src.image != null) data.image = assertImagePath(src.image);
  if (creating || src.meta != null) data.meta = assertString(src.meta, "meta", { min: 1, max: 200 });
  if (creating || src.blurb != null) data.blurb = assertString(src.blurb, "blurb", { min: 1, max: 2000 });
  if (src.isFeatured !== undefined) data.isFeatured = assertBool(src.isFeatured, "isFeatured");
  if (src.isDrop !== undefined) data.isDrop = assertBool(src.isDrop, "isDrop");
  if (src.isArrival !== undefined) data.isArrival = assertBool(src.isArrival, "isArrival");
  if (src.isActive !== undefined) data.isActive = assertBool(src.isActive, "isActive");
  if (src.specs !== undefined) data.specs = parseSpecs(src.specs);
  return data;
}

async function createProduct(body, actorId) {
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const parsed = readProductFields(body, CREATE_FIELDS, { creating: true });
  let initialStock = 0;
  if (body.stock !== undefined) {
    if (!Number.isInteger(body.stock) || body.stock < 0 || body.stock > 100000) {
      throw badRequest("Invalid stock");
    }
    initialStock = body.stock;
  }
  const specs = parsed.specs;
  delete parsed.specs;
  parsed.stock = 0;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.product.create({
        data: {
          ...parsed,
          specs: specs && specs.length ? { create: specs } : undefined,
        },
        include: { specs: { orderBy: { sort: "asc" } } },
      });
      if (initialStock > 0) {
        await tx.product.update({ where: { id: row.id }, data: { stock: initialStock } });
        await tx.inventoryAdjustment.create({
          data: {
            productId: row.id,
            actorId,
            delta: initialStock,
            previousStock: 0,
            resultingStock: initialStock,
            reason: "initial",
          },
        });
        row.stock = initialStock;
      }
      await audit.appendTx(tx, {
        actorId,
        action: "product.create",
        targetType: "product",
        targetId: row.id,
        metadata: { slug: row.slug },
      });
      return row;
    });
    return serializeAdminProduct(created, 0);
  } catch (err) {
    if (err && err.code === "P2002") throw conflict("Slug already in use");
    throw err;
  }
}

async function updateProduct(id, body, actorId) {
  const pid = assertProductId(id);
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  if ("stock" in body || "physicalStock" in body || "available" in body) {
    throw badRequest("Use inventory-adjustments to change stock");
  }
  const parsed = readProductFields(body, UPDATE_FIELDS, { creating: false });
  const specs = parsed.specs;
  delete parsed.specs;
  if (!Object.keys(parsed).length && specs === undefined) throw badRequest("Invalid details");
  const existing = await prisma.product.findUnique({ where: { id: pid } });
  if (!existing) throw notFound("Not found");
  try {
    const row = await prisma.$transaction(async (tx) => {
      if (specs) {
        await tx.productSpec.deleteMany({ where: { productId: pid } });
        if (specs.length) {
          await tx.productSpec.createMany({
            data: specs.map((s) => ({ productId: pid, sort: s.sort, label: s.label, value: s.value })),
          });
        }
      }
      const updated = await tx.product.update({
        where: { id: pid },
        data: parsed,
        include: { specs: { orderBy: { sort: "asc" } } },
      });
      await audit.appendTx(tx, {
        actorId,
        action: parsed.isActive === false ? "product.archive" : "product.update",
        targetType: "product",
        targetId: pid,
        metadata: { fields: Object.keys(parsed) },
      });
      return updated;
    });
    const reserved = await inventory.reservedQtyMap(prisma, [pid]);
    return serializeAdminProduct(row, reserved.get(pid) || 0);
  } catch (err) {
    if (err && err.code === "P2002") throw conflict("Slug already in use");
    throw err;
  }
}

async function archiveProduct(id, actorId) {
  const pid = assertProductId(id);
  const existing = await prisma.product.findUnique({ where: { id: pid } });
  if (!existing) throw notFound("Not found");
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: pid },
      data: { isActive: false },
      include: { specs: { orderBy: { sort: "asc" } } },
    });
    await audit.appendTx(tx, {
      actorId,
      action: "product.archive",
      targetType: "product",
      targetId: pid,
    });
    return updated;
  });
  const reserved = await inventory.reservedQtyMap(prisma, [pid]);
  return serializeAdminProduct(row, reserved.get(pid) || 0);
}

async function adjustInventory(id, body, actorId) {
  const pid = assertProductId(id);
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const delta = body.delta;
  if (!Number.isInteger(delta) || delta === 0 || delta < -100000 || delta > 100000) {
    throw badRequest("Invalid delta");
  }
  const reason = assertString(body.reason, "reason", { min: 1, max: 200 });
  let idempotencyKey = null;
  if (body.idempotencyKey != null && body.idempotencyKey !== "") {
    idempotencyKey = assertString(body.idempotencyKey, "idempotencyKey", { min: 8, max: 80 });
  }

  if (idempotencyKey) {
    const prior = await prisma.inventoryAdjustment.findUnique({ where: { idempotencyKey } });
    if (prior) {
      return {
        productId: prior.productId,
        delta: prior.delta,
        previousStock: prior.previousStock,
        resultingStock: prior.resultingStock,
        reason: prior.reason,
        replayed: true,
      };
    }
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        await inventory.lockProducts(tx, [pid]);
        const now = new Date();
        await inventory.expireOverdueForProducts(tx, [pid], now);
        const product = await tx.product.findUnique({ where: { id: pid } });
        if (!product) throw notFound("Not found");
        const reservedMap = await inventory.reservedQtyMap(tx, [pid], now);
        const reserved = reservedMap.get(pid) || 0;
        const previous = Number(product.stock || 0);
        const resulting = previous + delta;
        if (resulting < 0) throw conflict("Stock cannot be negative");
        if (resulting < reserved) throw conflict("Stock cannot fall below reserved quantity");
        await tx.product.update({ where: { id: pid }, data: { stock: resulting } });
        const adj = await tx.inventoryAdjustment.create({
          data: {
            productId: pid,
            actorId,
            delta,
            previousStock: previous,
            resultingStock: resulting,
            reason,
            idempotencyKey,
          },
        });
        await audit.appendTx(tx, {
          actorId,
          action: "inventory.adjust",
          targetType: "product",
          targetId: pid,
          metadata: { delta, previous, resulting, reason },
        });
        return {
          id: adj.id,
          productId: pid,
          delta,
          previousStock: previous,
          resultingStock: resulting,
          reservedQty: reserved,
          available: inventory.availableFrom(resulting, reserved),
          reason,
          replayed: false,
        };
      },
      { timeout: 15000 }
    );
  } catch (err) {
    if (err && err.code === "P2002") {
      const prior = await prisma.inventoryAdjustment.findUnique({ where: { idempotencyKey } });
      if (prior) {
        return {
          productId: prior.productId,
          delta: prior.delta,
          previousStock: prior.previousStock,
          resultingStock: prior.resultingStock,
          reason: prior.reason,
          replayed: true,
        };
      }
    }
    throw err;
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  adjustInventory,
  serializeAdminProduct,
};
