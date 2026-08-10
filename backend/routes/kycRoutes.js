const express = require("express");
const multer = require("multer");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const { submitKyc, approveKyc, rejectKyc } = require("../controller/kycController");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    // Video can be larger; CNIC images are capped at 10 MB in the controller
    fileSize: 15 * 1024 * 1024,
    files: 3,
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
    if (field === "face") {
      if (!(mime.startsWith("video/") || mime === "application/octet-stream")) {
        return cb(new Error("Selfie must be a video file"));
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
    { name: "face", maxCount: 1 },
  ])(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          ok: false,
          msg: "File too large. CNIC images max 10 MB each; selfie video max 15 MB.",
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
