"use strict";

function money(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function mapSpecs(specs) {
  if (!specs || !specs.length) return [];
  return [...specs]
    .sort((a, b) => a.sort - b.sort)
    .map((s) => [s.label, s.value]);
}

function mapProduct(row, reservedQty = 0) {
  if (!row) return null;
  const physical = Number(row.stock || 0);
  const reserved = Number(reservedQty || 0);
  const out = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    collection: row.collection,
    type: row.type,
    price: money(row.price),
    image: row.image,
    meta: row.meta,
    blurb: row.blurb,
    rating: money(row.rating),
    reviews: row.reviewCount,
    stock: Math.max(0, physical - reserved),
    isFeatured: row.isFeatured === true,
    isArrival: row.isArrival === true,
    isDrop: row.isDrop === true,
  };
  if (row.tag) out.tag = row.tag;
  if (row.tagline) out.tagline = row.tagline;
  if (row.compareAt != null) out.compareAt = money(row.compareAt);
  if (row.specs) out.specs = mapSpecs(row.specs);
  return out;
}

module.exports = { mapProduct, mapSpecs, money };
