const express = require("express");
const multer = require("multer");
const { protect, staffOrAdmin, adminOnly } = require("../middlewares/authMiddleware");
const {
  listMyThreads,
  listThreads,
  listThreadMessages,
  sendMessage,
  setThreadStatus,
  getUnread,
  markThreadRead,
  editMessage,
  deleteMessage,
} = require("../controller/supportController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname !== "image") {
      return cb(new Error("Unexpected upload field"));
    }
    if (!String(file.mimetype || "").startsWith("image/")) {
      return cb(new Error("Screenshot must be an image"));
    }
    return cb(null, true);
  },
});

function uploadSupportImage(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ ok: false, msg: "Screenshot too large (max 10 MB)" });
      }
      return res.status(400).json({ ok: false, msg: err.message || "Upload failed" });
    }
    return res.status(400).json({ ok: false, msg: err.message || "Upload failed" });
  });
}

router.get("/unread", protect, getUnread);
router.get("/threads/mine", protect, listMyThreads);
router.get("/threads", protect, staffOrAdmin, listThreads);
router.get("/threads/:id/messages", protect, listThreadMessages);
router.post("/threads/:id/read", protect, markThreadRead);
router.patch("/threads/:id/status", protect, staffOrAdmin, setThreadStatus);
router.patch("/messages/:id", protect, adminOnly, editMessage);
router.delete("/messages/:id", protect, adminOnly, deleteMessage);
router.post("/messages", protect, uploadSupportImage, sendMessage);

module.exports = router;
