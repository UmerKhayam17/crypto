const express = require("express");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const {
  listMyThreads,
  listThreads,
  listThreadMessages,
  sendMessage,
} = require("../controller/supportController");

const router = express.Router();

router.get("/threads/mine", protect, listMyThreads);
router.get("/threads", protect, staffOrAdmin, listThreads);
router.get("/threads/:id/messages", protect, listThreadMessages);
router.post("/messages", protect, sendMessage);

module.exports = router;

