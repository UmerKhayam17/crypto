const express = require("express");
const {
  listUsers,
  assignStaff,
  updateTradeControl,
  suspendUser,
  adjustBalance,
  setBalance,
  updateProfile,
  deleteUser,
} = require("../controller/userController");
const { protect, adminOnly, staffOrAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect, staffOrAdmin);

router.get("/", listUsers);
router.patch("/:id/assign", adminOnly, assignStaff);
router.patch("/:id/trade-control", updateTradeControl);
router.patch("/:id/suspend", suspendUser);
router.patch("/:id/balance/adjust", adminOnly, adjustBalance);
router.patch("/:id/balance", adminOnly, setBalance);
router.patch("/:id/profile", updateProfile);
router.delete("/:id", adminOnly, deleteUser);

module.exports = router;
