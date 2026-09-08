"use strict";

const { requireUser } = require("../middleware/auth");
const adminService = require("../services/adminService");
const catalog = require("../services/adminCatalogService");
const orders = require("../services/adminOrderService");
const customers = require("../services/adminCustomerService");
const content = require("../services/adminContentService");
const stats = require("../services/adminStatsService");

async function bootstrap(req, res) {
  const user = requireUser(req);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const result = await adminService.bootstrap({
    userId: user.id,
    email: user.email,
    secret: body.secret,
  });
  res.json(result);
}

async function session(req, res) {
  res.json(adminService.sessionPayload(req.admin));
}

async function capabilities(req, res) {
  res.json(adminService.capabilities());
}

async function audit(req, res) {
  res.json(await adminService.listAudit(req.query || {}));
}

async function listProducts(req, res) {
  res.json(await catalog.listProducts(req.query || {}));
}

async function getProduct(req, res) {
  res.json(await catalog.getProduct(req.params.id));
}

async function createProduct(req, res) {
  res.status(201).json(await catalog.createProduct(req.body, req.admin.id));
}

async function updateProduct(req, res) {
  res.json(await catalog.updateProduct(req.params.id, req.body, req.admin.id));
}

async function archiveProduct(req, res) {
  res.json(await catalog.archiveProduct(req.params.id, req.admin.id));
}

async function adjustInventory(req, res) {
  res.status(201).json(await catalog.adjustInventory(req.params.id, req.body, req.admin.id));
}

async function listOrders(req, res) {
  res.json(await orders.listOrders(req.query || {}));
}

async function getOrder(req, res) {
  res.json(await orders.getOrder(req.params.id));
}

async function cancelOrder(req, res) {
  res.json(await orders.cancel(req.params.id, req.admin.id));
}

async function dispatchOrder(req, res) {
  res.json(await orders.dispatch(req.params.id, req.admin.id));
}

async function listCustomers(req, res) {
  res.json(await customers.listCustomers(req.query || {}));
}

async function getCustomer(req, res) {
  res.json(await customers.getCustomer(req.params.id));
}

async function updateCustomer(req, res) {
  res.json(await customers.updateCustomer(req.params.id, req.body, req.admin.id));
}

async function listArticles(req, res) {
  res.json(await content.listArticles());
}

async function getArticle(req, res) {
  res.json(await content.getArticle(req.params.id));
}

async function createArticle(req, res) {
  res.status(201).json(await content.createArticle(req.body, req.admin.id));
}

async function updateArticle(req, res) {
  res.json(await content.updateArticle(req.params.id, req.body, req.admin.id));
}

async function deleteArticle(req, res) {
  res.json(await content.deleteArticle(req.params.id, req.admin.id));
}

async function listDrops(req, res) {
  res.json(await content.listDrops());
}

async function getDrop(req, res) {
  res.json(await content.getDrop(req.params.id));
}

async function createDrop(req, res) {
  res.status(201).json(await content.createDrop(req.body, req.admin.id));
}

async function updateDrop(req, res) {
  res.json(await content.updateDrop(req.params.id, req.body, req.admin.id));
}

async function deleteDrop(req, res) {
  res.json(await content.deleteDrop(req.params.id, req.admin.id));
}

async function getStats(req, res) {
  res.json(await stats.getStats());
}

module.exports = {
  bootstrap,
  session,
  capabilities,
  audit,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  adjustInventory,
  listOrders,
  getOrder,
  cancelOrder,
  dispatchOrder,
  listCustomers,
  getCustomer,
  updateCustomer,
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
  getStats,
};
