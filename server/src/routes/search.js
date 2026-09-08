"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { search } = require("../controllers/productController");

const router = Router();
router.get("/", asyncHandler(search));

module.exports = router;
