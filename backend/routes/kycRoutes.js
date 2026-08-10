const express = require("express");
const multer = require("multer");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const { submitKyc, approveKyc, rejectKyc } = require("../controller/kycController");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();

router.post(
  "/submit",
  protect,
  upload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
    { name: "face", maxCount: 1 },
  ]),
  submitKyc
);

router.patch("/:id/approve", protect, staffOrAdmin, approveKyc);
router.patch("/:id/reject", protect, staffOrAdmin, rejectKyc);

module.exports = router;
