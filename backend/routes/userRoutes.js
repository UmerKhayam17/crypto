const express = require("express");
const { listUsers, assignStaff, updateTradeControl } = require("../controller/userController");
const { protect, adminOnly, staffOrAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect, staffOrAdmin);

router.get("/", listUsers);
router.patch("/:id/assign", adminOnly, assignStaff);
router.patch("/:id/trade-control", updateTradeControl);

module.exports = router;
