"use strict";

const { prisma } = require("../db/prisma");
const { badRequest, notFound, conflict } = require("../utils/errors");
const { assertString, pickFields, assertProductId } = require("../utils/validate");
const audit = require("./auditService");

const ARTICLE_CREATE = ["id", "kind", "date", "title", "excerpt", "body"];
const ARTICLE_UPDATE = ["kind", "date", "title", "excerpt", "body"];

function assertArticleId(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    throw badRequest("Invalid id");
  }
  return value;
}

function parseBody(body) {
  if (!Array.isArray(body) || body.length < 1 || body.length > 40) throw badRequest("Invalid body");
  return body.map((p) => assertString(String(p), "body", { min: 1, max: 4000 }));
}

function mapArticle(row) {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function readArticle(body, keys, { creating }) {
  const src = pickFields(body, keys);
  const data = {};
  if (creating) data.id = assertArticleId(src.id);
  if (creating || src.kind != null) data.kind = assertString(src.kind, "kind", { min: 1, max: 40 });
  if (creating || src.date != null) data.date = assertString(src.date, "date", { min: 1, max: 40 });
  if (creating || src.title != null) data.title = assertString(src.title, "title", { min: 1, max: 200 });
  if (creating || src.excerpt != null) data.excerpt = assertString(src.excerpt, "excerpt", { min: 1, max: 2000 });
  if (creating || src.body != null) data.body = parseBody(src.body);
  return data;
}

async function listArticles() {
  const rows = await prisma.article.findMany({ orderBy: { createdAt: "desc" } });
  return { articles: rows.map(mapArticle) };
}

async function getArticle(id) {
  const aid = assertArticleId(id);
  const row = await prisma.article.findUnique({ where: { id: aid } });
  if (!row) throw notFound("Not found");
  return mapArticle(row);
}

async function createArticle(body, actorId) {
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const data = readArticle(body, ARTICLE_CREATE, { creating: true });
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({ data });
      await audit.appendTx(tx, {
        actorId,
        action: "article.create",
        targetType: "article",
        targetId: created.id,
      });
      return created;
    });
    return mapArticle(row);
  } catch (err) {
    if (err && err.code === "P2002") throw conflict("Already exists");
    throw err;
  }
}

async function updateArticle(id, body, actorId) {
  const aid = assertArticleId(id);
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const data = readArticle(body, ARTICLE_UPDATE, { creating: false });
  const existing = await prisma.article.findUnique({ where: { id: aid } });
  if (!existing) throw notFound("Not found");
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.article.update({ where: { id: aid }, data });
    await audit.appendTx(tx, {
      actorId,
      action: "article.update",
      targetType: "article",
      targetId: aid,
    });
    return updated;
  });
  return mapArticle(row);
}

async function deleteArticle(id, actorId) {
  const aid = assertArticleId(id);
  const existing = await prisma.article.findUnique({ where: { id: aid } });
  if (!existing) throw notFound("Not found");
  await prisma.$transaction(async (tx) => {
    await tx.article.delete({ where: { id: aid } });
    await audit.appendTx(tx, {
      actorId,
      action: "article.delete",
      targetType: "article",
      targetId: aid,
    });
  });
  return { ok: true, id: aid };
}

function assertIsoDate(value, field) {
  if (typeof value !== "string") throw badRequest("Invalid " + field);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw badRequest("Invalid " + field);
  return d;
}

function parseDropItems(items) {
  if (items == null) return [];
  if (!Array.isArray(items) || items.length > 24) throw badRequest("Invalid items");
  const seen = new Set();
  return items.map((item, i) => {
    const productId = assertProductId(item && (item.productId || item.id));
    if (seen.has(productId)) throw badRequest("Duplicate drop item");
    seen.add(productId);
    const sort = item && item.sort != null ? item.sort : i;
    if (!Number.isInteger(sort) || sort < 0 || sort > 100) throw badRequest("Invalid sort");
    return { productId, sort };
  });
}

function mapDrop(row) {
  return {
    id: row.id,
    endsAt: row.endsAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: (row.items || []).map((it) => ({
      productId: it.productId,
      sort: it.sort,
      name: it.product ? it.product.name : undefined,
    })),
  };
}

const DROP_INCLUDE = {
  items: { orderBy: { sort: "asc" }, include: { product: { select: { id: true, name: true, isActive: true } } } },
};

async function assertProductsExist(ids) {
  if (!ids.length) return;
  const unique = [...new Set(ids)];
  const found = await prisma.product.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) throw badRequest("Unknown product");
}

async function listDrops() {
  const rows = await prisma.drop.findMany({ include: DROP_INCLUDE, orderBy: { createdAt: "desc" } });
  return { drops: rows.map(mapDrop) };
}

async function getDrop(id) {
  const did = assertString(id, "id", { min: 8, max: 40 });
  const row = await prisma.drop.findUnique({ where: { id: did }, include: DROP_INCLUDE });
  if (!row) throw notFound("Not found");
  return mapDrop(row);
}

async function createDrop(body, actorId) {
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const endsAt = assertIsoDate(body.endsAt, "endsAt");
  const items = parseDropItems(body.items);
  await assertProductsExist(items.map((i) => i.productId));
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.drop.create({
      data: {
        endsAt,
        items: items.length ? { create: items } : undefined,
      },
      include: DROP_INCLUDE,
    });
    await audit.appendTx(tx, {
      actorId,
      action: "drop.create",
      targetType: "drop",
      targetId: created.id,
      metadata: { itemCount: items.length },
    });
    return created;
  });
  return mapDrop(row);
}

async function updateDrop(id, body, actorId) {
  const did = assertString(id, "id", { min: 8, max: 40 });
  if (!body || typeof body !== "object") throw badRequest("Invalid details");
  const existing = await prisma.drop.findUnique({ where: { id: did } });
  if (!existing) throw notFound("Not found");
  const data = {};
  if (body.endsAt != null) data.endsAt = assertIsoDate(body.endsAt, "endsAt");
  let items = null;
  if (body.items !== undefined) {
    items = parseDropItems(body.items);
    await assertProductsExist(items.map((i) => i.productId));
  }
  const row = await prisma.$transaction(async (tx) => {
    if (items) {
      await tx.dropItem.deleteMany({ where: { dropId: did } });
      if (items.length) {
        await tx.dropItem.createMany({
          data: items.map((it) => ({ dropId: did, productId: it.productId, sort: it.sort })),
        });
      }
    }
    const updated = await tx.drop.update({ where: { id: did }, data, include: DROP_INCLUDE });
    await audit.appendTx(tx, {
      actorId,
      action: "drop.update",
      targetType: "drop",
      targetId: did,
    });
    return updated;
  });
  return mapDrop(row);
}

async function deleteDrop(id, actorId) {
  const did = assertString(id, "id", { min: 8, max: 40 });
  const existing = await prisma.drop.findUnique({ where: { id: did } });
  if (!existing) throw notFound("Not found");
  await prisma.$transaction(async (tx) => {
    await tx.drop.delete({ where: { id: did } });
    await audit.appendTx(tx, {
      actorId,
      action: "drop.delete",
      targetType: "drop",
      targetId: did,
    });
  });
  return { ok: true, id: did };
}

module.exports = {
  listArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  listDrops,
  getDrop,
  createDrop,
  updateDrop,
  deleteDrop,
};
