const express = require("express");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const {
  createTrade,
  listMyTrades,
  listTrades,
  planTrade,
  closeMyTrade,
  settleTrade,
  deleteTrade,
  clearResolvedTrades,
} = require("../controller/tradeController");

const router = express.Router();

router.post("/", protect, createTrade);
router.get("/mine", protect, listMyTrades);
router.get("/", protect, staffOrAdmin, listTrades);
router.patch("/:id/plan", protect, staffOrAdmin, planTrade);
router.patch("/:id/close", protect, closeMyTrade);
router.patch("/:id/settle", protect, staffOrAdmin, settleTrade);
router.delete("/:id", protect, staffOrAdmin, deleteTrade);
router.delete("/", protect, staffOrAdmin, clearResolvedTrades);

module.exports = router;
