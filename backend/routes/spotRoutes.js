const express = require("express");
const { protect, staffOrAdmin } = require("../middlewares/authMiddleware");
const {
  openSpot,
  closeSpot,
  listMySpot,
  listSpot,
  getSpotFee,
} = require("../controller/spotController");

const router = express.Router();

router.get("/fee", protect, getSpotFee);
router.post("/", protect, openSpot);
router.get("/mine", protect, listMySpot);
router.get("/", protect, staffOrAdmin, listSpot);
router.patch("/:id/close", protect, closeSpot);

module.exports = router;
