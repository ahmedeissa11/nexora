"use strict";

const productService = require("../services/productService");
const { assertProductId, assertSearchQuery } = require("../utils/validate");

async function list(req, res) {
  const result = await productService.listProducts(req.query);
  res.json(result);
}

async function getOne(req, res) {
  const id = assertProductId(req.params.id);
  const result = await productService.getProductById(id);
  res.json(result);
}

async function search(req, res) {
  const q = assertSearchQuery(req.query.q || "");
  const result = await productService.searchProducts(q);
  res.json(result);
}

module.exports = { list, getOne, search };
