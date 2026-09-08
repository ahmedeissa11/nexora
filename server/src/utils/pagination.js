"use strict";

const { badRequest } = require("./errors");

const CATEGORY_MAP = {
  Headphones: ["Headphones", "Audio"],
  "Smart Watches": ["Smart Watches", "Time"],
  Keyboards: ["Keyboards", "Desk"],
  Mice: ["Mice"],
  Speakers: ["Speakers"],
  Sneakers: ["Sneakers"],
  Accessories: ["Accessories", "Light"],
};

function parsePagination(query) {
  const page = query.page === undefined || query.page === "" ? 1 : Number(query.page);
  const perPage =
    query.perPage === undefined || query.perPage === "" ? 12 : Number(query.perPage);
  if (!Number.isInteger(page) || page < 1 || page > 200) {
    throw badRequest("page must be an integer between 1 and 200");
  }
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw badRequest("perPage must be an integer between 1 and 100");
  }
  return { page, perPage, skip: (page - 1) * perPage };
}

function parsePriceFilter(id) {
  if (!id || id === "All") return null;
  if (id === "0-150") return { lt: 150 };
  if (id === "150-300") return { gte: 150, lte: 300 };
  if (id === "300-600") return { gt: 300, lte: 600 };
  if (id === "600+") return { gt: 600 };
  throw badRequest("Invalid price filter");
}

function parseCategories(cat) {
  if (!cat || cat === "All") return null;
  if (cat.includes("|")) return cat.split("|").map((s) => s.trim()).filter(Boolean);
  if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
  return [cat];
}

function parseSort(sort) {
  const key = sort || "featured";
  if (key === "price-asc") return [{ price: "asc" }, { name: "asc" }];
  if (key === "price-desc") return [{ price: "desc" }, { name: "asc" }];
  if (key === "rating") return [{ rating: "desc" }, { reviewCount: "desc" }];
  if (key === "name") return [{ name: "asc" }];
  if (key === "featured") return [{ isFeatured: "desc" }, { name: "asc" }];
  throw badRequest("Invalid sort");
}

module.exports = {
  CATEGORY_MAP,
  parsePagination,
  parsePriceFilter,
  parseCategories,
  parseSort,
};
