"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { home } = require("../controllers/homeController");

const router = Router();
router.get("/", asyncHandler(home));

module.exports = router;
