"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { health } = require("../controllers/healthController");

const router = Router();
router.get("/", asyncHandler(health));

module.exports = router;
