const express = require("express");
const { listStaff, createStaff, updateStaff, deleteStaff } = require("../controller/staffController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.get("/", listStaff);
router.post("/", createStaff);
router.patch("/:id", updateStaff);
router.delete("/:id", deleteStaff);

module.exports = router;
