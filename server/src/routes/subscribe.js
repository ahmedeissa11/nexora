"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { authLimiter, noStore } = require("../middleware/security");
const ctrl = require("../controllers/subscribeController");

const router = Router();
router.post("/", noStore, authLimiter, asyncHandler(ctrl.create));

module.exports = router;
