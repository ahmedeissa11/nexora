"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { noStore, bootstrapLimiter, adminLimiter } = require("../middleware/security");
const { requireAdmin } = require("../middleware/admin");
const ctrl = require("../controllers/adminController");

const router = Router();
router.use(noStore);
router.use(adminLimiter);

router.post("/bootstrap", bootstrapLimiter, asyncHandler(ctrl.bootstrap));

router.use(requireAdmin);
router.get("/session", asyncHandler(ctrl.session));
router.get("/capabilities", asyncHandler(ctrl.capabilities));
router.get("/audit", asyncHandler(ctrl.audit));
router.get("/stats", asyncHandler(ctrl.getStats));

router.get("/products", asyncHandler(ctrl.listProducts));
router.post("/products", asyncHandler(ctrl.createProduct));
router.get("/products/:id", asyncHandler(ctrl.getProduct));
router.patch("/products/:id", asyncHandler(ctrl.updateProduct));
router.delete("/products/:id", asyncHandler(ctrl.archiveProduct));
router.post("/products/:id/inventory-adjustments", asyncHandler(ctrl.adjustInventory));

router.get("/orders", asyncHandler(ctrl.listOrders));
router.get("/orders/:id", asyncHandler(ctrl.getOrder));
router.post("/orders/:id/cancel", asyncHandler(ctrl.cancelOrder));
router.post("/orders/:id/dispatch", asyncHandler(ctrl.dispatchOrder));

router.get("/customers", asyncHandler(ctrl.listCustomers));
router.get("/customers/:id", asyncHandler(ctrl.getCustomer));
router.patch("/customers/:id", asyncHandler(ctrl.updateCustomer));

router.get("/articles", asyncHandler(ctrl.listArticles));
router.post("/articles", asyncHandler(ctrl.createArticle));
router.get("/articles/:id", asyncHandler(ctrl.getArticle));
router.patch("/articles/:id", asyncHandler(ctrl.updateArticle));
router.delete("/articles/:id", asyncHandler(ctrl.deleteArticle));

router.get("/drops", asyncHandler(ctrl.listDrops));
router.post("/drops", asyncHandler(ctrl.createDrop));
router.get("/drops/:id", asyncHandler(ctrl.getDrop));
router.patch("/drops/:id", asyncHandler(ctrl.updateDrop));
router.delete("/drops/:id", asyncHandler(ctrl.deleteDrop));

module.exports = router;
