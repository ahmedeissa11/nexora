"use strict";

const crypto = require("crypto");
const { Prisma } = require("@prisma/client");
const { prisma } = require("../db/prisma");
const { config } = require("../config");
const { mapProduct } = require("../utils/mapProduct");
const { badRequest, notFound, conflict } = require("../utils/errors");
const inventory = require("./inventoryService");

const VALID_FINISHES = new Set(["graphite", "midnight", "oxide"]);
const MAX_QTY = 99;
const TOKEN_BYTES = 32;

function dec(value) {
  return new Prisma.Decimal(value);
}

function money(value) {
  return Number(dec(value).toFixed(2));
}

function serializeCart(cart, reservedByProduct = new Map()) {
  let subtotalDec = dec(0);
  const items = (cart.items || []).filter((line) => line.product && line.product.isActive !== false).map((line) => {
    const reserved = reservedByProduct.get(line.productId) || 0;
    const product = mapProduct(line.product, reserved);
    const lineDec = dec(line.product.price).mul(line.qty);
    subtotalDec = subtotalDec.plus(lineDec);
    return {
      product: {
        id: product.id,
        name: product.name,
        image: product.image,
        price: product.price,
        stock: product.stock,
      },
      qty: line.qty,
      finish: line.finish,
      lineTotal: money(lineDec),
    };
  });
  const subtotal = money(subtotalDec);
  const shipping = 0;
  const total = money(subtotalDec.plus(shipping));
  return { items, subtotal, shipping, total };
}

const CART_INCLUDE = {
  items: {
    include: { product: { include: { specs: { orderBy: { sort: "asc" } } } } },
    orderBy: { id: "asc" },
  },
};

function hashCartToken(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digest = crypto.createHmac("sha256", config.sessionSecret).update("cart:" + raw).digest("hex");
  return "v1:" + digest;
}

async function loadCartByToken(token, tx = prisma) {
  if (!token || typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  if (token.startsWith("v1:")) return null;
  const hashed = hashCartToken(token);
  let cart = await tx.cart.findUnique({
    where: { token: hashed },
    include: CART_INCLUDE,
  });
  if (cart) return cart;
  cart = await tx.cart.findUnique({
    where: { token },
    include: CART_INCLUDE,
  });
  if (cart) {
    try {
      await tx.cart.update({ where: { id: cart.id }, data: { token: hashed } });
      cart.token = hashed;
    } catch (_err) {
      /* unique race — hashed lookup will succeed next time */
    }
    return cart;
  }
  return null;
}

async function loadCartByUserId(userId) {
  if (!userId) return null;
  return prisma.cart.findUnique({
    where: { userId },
    include: CART_INCLUDE,
  });
}

async function getOrCreateUserCart(userId) {
  let cart = await loadCartByUserId(userId);
  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: CART_INCLUDE,
    });
  }
  return cart;
}

async function mergeGuestIntoUser(guestToken, userId) {
  if (!userId) return;

  await prisma.$transaction(async (tx) => {
    const guest = guestToken ? await loadCartByToken(guestToken, tx) : null;

    let userCart = await tx.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    const lockIds = [];
    if (guest && guest.id) lockIds.push(guest.id);
    if (userCart && userCart.id) lockIds.push(userCart.id);
    const uniqueLocks = [...new Set(lockIds)].sort();
    if (uniqueLocks.length) {
      await tx.$queryRaw`SELECT id FROM "Cart" WHERE id IN (${Prisma.join(uniqueLocks)}) ORDER BY id FOR UPDATE`;
    }

    const guestIsOurs = guest && !guest.userId;

    if (guestIsOurs && !userCart) {
      await tx.cart.update({
        where: { id: guest.id },
        data: { userId, token: null },
      });
      userCart = await tx.cart.findUnique({
        where: { id: guest.id },
        include: { items: true },
      });
    } else if (guestIsOurs && userCart && guest.id === userCart.id) {
      await tx.cart.update({
        where: { id: guest.id },
        data: { token: null, userId },
      });
    } else if (guestIsOurs && userCart) {
      for (const line of guest.items) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product || product.isActive === false || product.stock <= 0) continue;
        const existing = userCart.items.find(
          (i) => i.productId === line.productId && i.finish === line.finish
        );
        const combined = (existing ? existing.qty : 0) + line.qty;
        const nextQty = Math.min(combined, product.stock, MAX_QTY);
        if (nextQty < 1) continue;
        if (existing) {
          await tx.cartItem.update({ where: { id: existing.id }, data: { qty: nextQty } });
          existing.qty = nextQty;
        } else {
          const created = await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: line.productId,
              finish: line.finish,
              qty: nextQty,
            },
          });
          userCart.items.push(created);
        }
      }
      await tx.cartItem.deleteMany({ where: { cartId: guest.id } });
      await tx.cart.delete({ where: { id: guest.id } });
    }

    if (!userCart) {
      userCart = await tx.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    for (const item of userCart.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product || product.isActive === false || product.stock <= 0) {
        await tx.cartItem.delete({ where: { id: item.id } }).catch(() => {});
      } else if (item.qty > product.stock) {
        await tx.cartItem.update({
          where: { id: item.id },
          data: { qty: Math.min(item.qty, product.stock, MAX_QTY) },
        });
      }
    }

    await tx.cart.update({ where: { id: userCart.id }, data: { updatedAt: new Date() } });
  });
}

function newToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
}

async function getOrCreateCart(token) {
  let cart = await loadCartByToken(token);
  let issuedToken = null;
  if (!cart) {
    issuedToken = newToken();
    cart = await prisma.cart.create({
      data: { token: hashCartToken(issuedToken) },
      include: {
        items: {
          include: { product: { include: { specs: { orderBy: { sort: "asc" } } } } },
        },
      },
    });
  }
  return { cart, issuedToken };
}

function assertFinish(finish, { optional = false } = {}) {
  if (finish === undefined || finish === null || finish === "") {
    if (optional) return "graphite";
    throw badRequest("Invalid finish");
  }
  if (typeof finish !== "string") throw badRequest("Invalid finish");
  const value = finish.trim();
  if (!VALID_FINISHES.has(value)) throw badRequest("Invalid finish");
  return value;
}

function assertQty(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_QTY) {
    throw badRequest("quantity must be an integer greater than 0");
  }
  return value;
}

function assertProductId(id) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(id)) {
    throw badRequest("Invalid product id");
  }
  return id;
}

function rejectClientPrice(body) {
  if (!body || typeof body !== "object") return;
  if ("price" in body || "subtotal" in body || "total" in body || "stock" in body || "lineTotal" in body) {
    /* ignored — never used */
  }
}

async function addItem(cartId, body) {
  rejectClientPrice(body);
  const productId = assertProductId(body && body.id);
  const qty =
    body && Object.prototype.hasOwnProperty.call(body, "qty") ? assertQty(body.qty) : 1;
  const finish = assertFinish(body && body.finish, { optional: true });

  return prisma.$transaction(async (tx) => {
    await inventory.lockProducts(tx, [productId]);
    await inventory.expireOverdueForProducts(tx, [productId]);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.isActive === false) throw notFound("This piece is no longer in the house.");
    const reserved = await inventory.reservedQtyMap(tx, [productId]);
    const available = inventory.availableFrom(product.stock, reserved.get(productId) || 0);
    if (product.stock <= 0 || available <= 0) throw conflict("This product is currently between lots");

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_productId_finish: { cartId, productId, finish },
      },
    });
    const nextQty = (existing ? existing.qty : 0) + qty;
    if (nextQty > available) throw conflict("Not enough stock available");
    if (nextQty > MAX_QTY) throw badRequest("quantity must be an integer greater than 0");

    if (existing) {
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { qty: nextQty },
      });
    } else {
      await tx.cartItem.create({
        data: { cartId, productId, qty, finish },
      });
    }

    await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  });
}

async function setItemQty(cartId, body) {
  rejectClientPrice(body);
  const productId = assertProductId(body && body.id);
  const qty = assertQty(body && body.qty);
  const finish = assertFinish(body && body.finish);

  return prisma.$transaction(async (tx) => {
    await inventory.lockProducts(tx, [productId]);
    await inventory.expireOverdueForProducts(tx, [productId]);
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || product.isActive === false) throw notFound("This piece is no longer in the house.");
    const reserved = await inventory.reservedQtyMap(tx, [productId]);
    const available = inventory.availableFrom(product.stock, reserved.get(productId) || 0);
    if (product.stock <= 0 || available <= 0) throw conflict("This product is currently between lots");
    if (qty > available) throw conflict("Not enough stock available");

    const existing = await tx.cartItem.findUnique({
      where: {
        cartId_productId_finish: { cartId, productId, finish },
      },
    });
    if (!existing) throw notFound("That line is not in the cart");

    await tx.cartItem.update({
      where: { id: existing.id },
      data: { qty },
    });
    await tx.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  });
}

async function removeItem(cartId, productId, finish) {
  const id = assertProductId(productId);
  const fin = assertFinish(finish);
  const existing = await prisma.cartItem.findUnique({
    where: {
      cartId_productId_finish: { cartId, productId: id, finish: fin },
    },
  });
  if (!existing) throw notFound("That line is not in the cart");
  await prisma.cartItem.delete({ where: { id: existing.id } });
  await prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
}

async function getSerialized(cartId) {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: { product: { include: { specs: { orderBy: { sort: "asc" } } } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!cart) throw notFound("Cart not found");
  const ids = (cart.items || []).map((i) => i.productId);
  const reserved = await inventory.reservedQtyMap(prisma, ids);
  return serializeCart(cart, reserved);
}

async function findExistingCart(userId, token) {
  if (userId) return loadCartByUserId(userId);
  return loadCartByToken(token);
}

module.exports = {
  VALID_FINISHES,
  getOrCreateCart,
  getOrCreateUserCart,
  mergeGuestIntoUser,
  findExistingCart,
  serializeCart,
  addItem,
  setItemQty,
  removeItem,
  getSerialized,
};
