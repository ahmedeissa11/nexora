"use strict";

const { prisma } = require("../db/prisma");
const { decorateProducts } = require("./inventoryService");

const specInclude = { specs: { orderBy: { sort: "asc" } } };

const FEATURED_ORDER = [
  "nova-pro-wireless",
  "apex-smart-watch",
  "pulse-max",
  "aerosound-x",
  "drift",
  "halo",
  "type",
  "phantom-anc",
];

function orderByIds(rows, ids) {
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

async function getHome() {
  const drop = await prisma.drop.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { sort: "asc" },
        include: { product: { include: specInclude } },
      },
    },
  });

  const [featuredRows, arrivalRows, dealRows] = await Promise.all([
    prisma.product.findMany({
      where: { isFeatured: true, isActive: true },
      include: specInclude,
    }),
    prisma.product.findMany({
      where: { isArrival: true, isActive: true },
      include: specInclude,
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.product.findMany({
      where: { compareAt: { not: null }, isActive: true },
      include: specInclude,
      orderBy: { name: "asc" },
    }),
  ]);

  const dropRows = drop ? drop.items.map((item) => item.product).filter((p) => p && p.isActive !== false) : [];
  const [featured, dropProducts, arrivals, deals] = await Promise.all([
    decorateProducts(orderByIds(featuredRows, FEATURED_ORDER)),
    decorateProducts(dropRows),
    decorateProducts(arrivalRows),
    decorateProducts(dealRows),
  ]);

  return {
    featured,
    drop: {
      endsAt: drop ? drop.endsAt.toISOString() : null,
      products: dropProducts,
    },
    arrivals,
    deals,
  };
}

module.exports = { getHome };
