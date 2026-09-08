"use strict";

const { Router } = require("express");
const { apiLimiter, originGuard, noStore } = require("../middleware/security");
const { attachUser } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/error");
const health = require("./health");
const { live, ready } = require("../controllers/healthController");
const products = require("./products");
const search = require("./search");
const home = require("./home");
const articles = require("./articles");
const cart = require("./cart");
const auth = require("./auth");
const orders = require("./orders");
const admin = require("./admin");
const subscribe = require("./subscribe");
const authCtrl = require("../controllers/authController");

const router = Router();
router.use(originGuard);
router.use(attachUser);
router.get("/live", live);
router.get("/ready", asyncHandler(ready));
router.use(apiLimiter);
router.use("/health", health);
router.use("/products", products);
router.use("/search", search);
router.use("/home", home);
router.use("/articles", articles);
router.use("/cart", cart);
router.use("/auth", auth);
router.use("/orders", orders);
router.use("/admin", admin);
router.use("/subscribe", subscribe);
router.get("/me", noStore, asyncHandler(authCtrl.me));

module.exports = router;
