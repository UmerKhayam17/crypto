const express = require("express");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const { getMyVipStatus, claimVipReward, listVipClaims } = require("../controller/vipController");

const router = express.Router();

router.get("/mine", protect, getMyVipStatus);
router.post("/claim", protect, claimVipReward);
router.get("/claims", protect, staffOrAdmin, listVipClaims);

module.exports = router;
