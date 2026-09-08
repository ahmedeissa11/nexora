"use strict";

const { prisma } = require("../db/prisma");
const { mapProduct } = require("../utils/mapProduct");
const { notFound, badRequest } = require("../utils/errors");
const { escapeLike } = require("../utils/validate");
const { decorateProducts } = require("./inventoryService");
const {
  parsePagination,
  parsePriceFilter,
  parseCategories,
  parseSort,
} = require("../utils/pagination");

const specInclude = { specs: { orderBy: { sort: "asc" } } };

async function listProducts(query) {
  const { page, perPage, skip } = parsePagination(query);
  const cats = parseCategories(query.cat);
  const price = parsePriceFilter(query.price);
  const orderBy = parseSort(query.sort);
  const rawQ = typeof query.q === "string" ? query.q.trim() : "";
  if (rawQ.length > 120) throw badRequest("Invalid search query");
  const q = rawQ ? escapeLike(rawQ) : "";

  const where = { isActive: true };
  if (cats) where.category = { in: cats };
  if (price) where.price = price;
  if (rawQ && !q) {
    return { products: [], total: 0, page, perPage };
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { collection: { contains: q, mode: "insensitive" } },
      { type: { contains: q, mode: "insensitive" } },
      { tagline: { contains: q, mode: "insensitive" } },
      { blurb: { contains: q, mode: "insensitive" } },
      { meta: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: specInclude,
      orderBy,
      skip,
      take: perPage,
    }),
  ]);

  return {
    products: await decorateProducts(rows),
    total,
    page,
    perPage,
  };
}

async function getProductById(id) {
  const row = await prisma.product.findUnique({
    where: { id },
    include: specInclude,
  });
  if (!row || row.isActive === false) throw notFound("This piece is no longer in the house.");

  const relatedRows = await prisma.product.findMany({
    where: { category: row.category, id: { not: row.id }, isActive: true },
    include: specInclude,
    take: 4,
    orderBy: { rating: "desc" },
  });

  const [product, related] = await Promise.all([
    decorateProducts([row]).then((xs) => xs[0]),
    decorateProducts(relatedRows),
  ]);
  return {
    product,
    specs: product.specs,
    related,
  };
}

async function searchProducts(q) {
  const term = escapeLike(String(q || "").trim());
  if (!term) return { products: [], total: 0 };
  const rows = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { category: { contains: term, mode: "insensitive" } },
        { collection: { contains: term, mode: "insensitive" } },
        { type: { contains: term, mode: "insensitive" } },
        { tagline: { contains: term, mode: "insensitive" } },
        { blurb: { contains: term, mode: "insensitive" } },
      ],
    },
    include: specInclude,
    take: 24,
    orderBy: [{ rating: "desc" }, { name: "asc" }],
  });
  const products = await decorateProducts(rows);
  return { products, total: products.length };
}

module.exports = { listProducts, getProductById, searchProducts };
