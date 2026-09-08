"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const ctrl = require("../controllers/articleController");

const router = Router();
router.get("/", asyncHandler(ctrl.list));
router.get("/:id", asyncHandler(ctrl.getOne));

module.exports = router;
