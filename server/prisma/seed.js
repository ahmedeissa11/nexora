"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const FEATURED = [
  "nova-pro-wireless",
  "apex-smart-watch",
  "pulse-max",
  "aerosound-x",
  "drift",
  "halo",
  "type",
  "phantom-anc",
];
const DROP_IDS = [
  "one",
  "nova-pro-wireless",
  "phantom-anc",
  "orbit-watch",
  "apex-smart-watch",
  "type",
];
const ORIGINALS = new Set(["one", "drift", "field", "halo", "meridian", "type", "vessel", "arc"]);
const DROP_ENDS_AT = new Date("2026-09-30T20:00:00.000Z");

function slugify(id, name) {
  return id;
}

function isProductionEnv() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

async function assertSeedAllowed() {
  if (isProductionEnv()) {
    throw new Error(
      "Refusing to seed: NODE_ENV=production. Production catalog changes go through Admin; production schema uses prisma migrate deploy only."
    );
  }
  const [
    orders,
    orderItems,
    reservations,
    adjustments,
    stripeEvents,
    carts,
    cartItems,
    wishlists,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.inventoryReservation.count(),
    prisma.inventoryAdjustment.count(),
    prisma.stripeEvent.count(),
    prisma.cart.count(),
    prisma.cartItem.count(),
    prisma.wishlist.count(),
  ]);
  const blocking = {
    orders,
    orderItems,
    reservations,
    adjustments,
    stripeEvents,
    carts,
    cartItems,
    wishlists,
  };
  const total = Object.values(blocking).reduce((a, n) => a + n, 0);
  if (total > 0) {
    throw new Error(
      "Refusing to seed: transactional rows exist (" +
        JSON.stringify(blocking) +
        "). Seed never truncates or deletes orders, reservations, carts, or wishlists."
    );
  }
}

async function main() {
  await assertSeedAllowed();

  const raw = fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8");
  const { products, articles } = JSON.parse(raw);

  if (!Array.isArray(products) || products.length !== 64) {
    throw new Error(`Expected 64 products, got ${products && products.length}`);
  }

  await prisma.dropItem.deleteMany();
  await prisma.drop.deleteMany();
  await prisma.productSpec.deleteMany();
  await prisma.review.deleteMany();
  await prisma.article.deleteMany();
  await prisma.finish.deleteMany();
  await prisma.product.deleteMany();

  await prisma.finish.createMany({
    data: [
      { id: "graphite", name: "Graphite", color: "#6b717c" },
      { id: "midnight", name: "Midnight", color: "#1c1f27" },
      { id: "oxide", name: "Oxide", color: "#5c534c" },
    ],
  });

  const catalogOrder = products.filter((p) => !ORIGINALS.has(p.id)).map((p) => p.id);
  const arrivalSet = new Set(catalogOrder.slice(0, 12));

  for (const p of products) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        slug: slugify(p.id, p.name),
        category: p.category,
        collection: p.collection,
        type: p.type,
        tag: p.tag || null,
        tagline: p.tagline || null,
        price: p.price,
        compareAt: p.compareAt != null ? p.compareAt : null,
        image: p.image,
        meta: p.meta,
        blurb: p.blurb,
        rating: p.rating != null ? p.rating : 0,
        reviewCount: p.reviews != null ? p.reviews : 0,
        stock: p.stock != null ? p.stock : 0,
        isFeatured: FEATURED.includes(p.id),
        isDrop: DROP_IDS.includes(p.id),
        isArrival: arrivalSet.has(p.id),
        specs: {
          create: (p.specs || []).map((pair, i) => ({
            sort: i,
            label: pair[0],
            value: pair[1],
          })),
        },
      },
    });
  }

  const drop = await prisma.drop.create({
    data: { endsAt: DROP_ENDS_AT },
  });
  await prisma.dropItem.createMany({
    data: DROP_IDS.map((productId, sort) => ({
      dropId: drop.id,
      productId,
      sort,
    })),
  });

  for (const a of articles) {
    await prisma.article.create({
      data: {
        id: a.id,
        kind: a.kind,
        date: a.date,
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
      },
    });
  }

  await prisma.review.createMany({
    data: [
      {
        productId: "one",
        author: "A. Mendes",
        rating: 5,
        body: "Quiet, considered, and exactly as described. It recedes until you need it.",
      },
      {
        productId: "one",
        author: "L. Rourke",
        rating: 5,
        body: "The finish is why it stayed on the desk. No glare, no announcement.",
      },
      {
        productId: "nova-pro-wireless",
        author: "S. Ito",
        rating: 5,
        body: "Nova Pro Wireless feels finished, not assembled. A rare thing in this category.",
      },
    ],
  });

  const count = await prisma.product.count();
  console.log(`Seeded ${count} products, ${articles.length} articles, drop ends ${DROP_ENDS_AT.toISOString()}`);
}

main()
  .catch((err) => {
    const msg = String((err && err.message) || err || "").replace(/postgresql:\/\/[^\s]+/gi, "postgresql://redacted");
    console.error(msg);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
