const express = require("express");
const { protect, adminOnly } = require("../middlewares/authMiddleware");
const { getPublicSettings, updateSettings } = require("../controller/settingsController");

const router = express.Router();

router.get("/public", getPublicSettings);
router.patch("/", protect, adminOnly, updateSettings);

module.exports = router;
