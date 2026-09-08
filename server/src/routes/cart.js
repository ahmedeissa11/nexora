"use strict";

const { Router } = require("express");
const { asyncHandler } = require("../middleware/error");
const { noStore } = require("../middleware/security");
const ctrl = require("../controllers/cartController");

const router = Router();
router.use(noStore);
router.get("/", asyncHandler(ctrl.get));
router.post("/", asyncHandler(ctrl.add));
router.patch("/", asyncHandler(ctrl.patch));
router.delete("/:productId/:finish", asyncHandler(ctrl.remove));

module.exports = router;
