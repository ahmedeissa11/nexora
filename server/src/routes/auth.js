"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { authLimiter } = require("../middleware/security");
const ctrl = require("../controllers/authController");

const router = Router();
router.post("/register", authLimiter, asyncHandler(ctrl.register));
router.post("/login", authLimiter, asyncHandler(ctrl.login));
router.post("/logout", asyncHandler(ctrl.logout));

module.exports = router;
