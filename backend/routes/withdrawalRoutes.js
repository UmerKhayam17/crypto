const express = require("express");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const {
  createWithdrawal,
  listMyWithdrawals,
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  cancelWithdrawal,
} = require("../controller/withdrawalController");

const router = express.Router();

router.post("/", protect, createWithdrawal);
router.get("/mine", protect, listMyWithdrawals);
router.get("/", protect, staffOrAdmin, listWithdrawals);
router.patch("/:id/approve", protect, staffOrAdmin, approveWithdrawal);
router.patch("/:id/reject", protect, staffOrAdmin, rejectWithdrawal);
router.delete("/:id", protect, cancelWithdrawal);

module.exports = router;
