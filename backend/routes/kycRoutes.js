const express = require("express");
const multer = require("multer");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const { submitKyc, approveKyc, rejectKyc } = require("../controller/kycController");

const MAX_KYC_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_KYC_IMAGE_BYTES,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    const field = file.fieldname;
    const mime = file.mimetype || "";
    if (field === "cnicFront" || field === "cnicBack") {
      if (!mime.startsWith("image/")) {
        return cb(new Error("CNIC must be an image file"));
      }
      return cb(null, true);
    }
    return cb(new Error("Unexpected upload field"));
  },
});

const router = express.Router();

function uploadKyc(req, res, next) {
  upload.fields([
    { name: "cnicFront", maxCount: 1 },
    { name: "cnicBack", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          msg: "Image too large (max 10 MB each).",
        });
      }
      return res.status(400).json({ ok: false, msg: err.message || "Upload failed" });
    }
    return res.status(400).json({ ok: false, msg: err.message || "Upload failed" });
  });
}

router.post("/submit", protect, uploadKyc, submitKyc);

router.patch("/:id/approve", protect, staffOrAdmin, approveKyc);
router.patch("/:id/reject", protect, staffOrAdmin, rejectKyc);

module.exports = router;
