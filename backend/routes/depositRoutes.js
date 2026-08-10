const express = require("express");
const multer = require("multer");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const {
  createDeposit,
  listMyDeposits,
  listDeposits,
  approveDeposit,
  rejectDeposit,
  cancelDeposit,
} = require("../controller/depositController");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const router = express.Router();

router.post("/", protect, upload.single("screenshot"), createDeposit);
router.get("/mine", protect, listMyDeposits);
router.get("/", protect, staffOrAdmin, listDeposits);
router.patch("/:id/approve", protect, staffOrAdmin, approveDeposit);
router.patch("/:id/reject", protect, staffOrAdmin, rejectDeposit);
router.delete("/:id", protect, cancelDeposit);

module.exports = router;
