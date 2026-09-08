"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { checkoutLimiter, noStore } = require("../middleware/security");
const ctrl = require("../controllers/orderController");
const paymentCtrl = require("../controllers/paymentController");

const router = Router();
router.use(noStore);
router.post("/", checkoutLimiter, asyncHandler(ctrl.create));
router.post("/:id/checkout-session", checkoutLimiter, asyncHandler(paymentCtrl.createCheckoutSession));
router.get("/", asyncHandler(ctrl.list));
router.get("/:id", asyncHandler(ctrl.get));

module.exports = router;
