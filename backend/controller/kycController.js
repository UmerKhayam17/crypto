const path = require("path");
const fs = require("fs");
const User = require("../model/User");
const formatUser = require("../utils/formatUser");
const notify = require("../utils/realtimeNotify");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

exports.submitKyc = async (req, res) => {
  try {
    const user = req.user;
    const files = req.files || {};

    if (!files.cnicFront || !files.cnicBack) {
      return res.status(400).json({ ok: false, msg: "Front and back CNIC photos are required" });
    }

    const frontFile = files.cnicFront[0];
    const backFile = files.cnicBack[0];
    const videoFile = files.face?.[0];

    const extFront = path.extname(frontFile.originalname || "") || ".jpg";
    const extBack = path.extname(backFile.originalname || "") || ".jpg";
    const extFace = videoFile ? path.extname(videoFile.originalname || "") || ".webm" : "";

    const frontName = `${user._id}-front${extFront}`;
    const backName = `${user._id}-back${extBack}`;
    const faceName = videoFile ? `${user._id}-face${extFace}` : "";

    const saveFile = (file, targetName) => {
      const targetPath = path.join(uploadDir, targetName);
      fs.writeFileSync(targetPath, file.buffer);
      return targetName;
    };


    const frontSaved = saveFile(frontFile, frontName);
    const backSaved = saveFile(backFile, backName);
    const faceSaved = videoFile ? saveFile(videoFile, faceName) : "";

    const host = req.get("host");
    const protocol = req.protocol;
    const frontUrl = `${protocol}://${host}/uploads/${frontSaved}`;
    const backUrl = `${protocol}://${host}/uploads/${backSaved}`;
    const faceUrl = faceSaved ? `${protocol}://${host}/uploads/${faceSaved}` : "";

    user.kyc = {
      ...user.kyc.toObject ? user.kyc.toObject() : user.kyc,
      status: "pending",
      cnicFront: frontUrl,
      cnicBack: backUrl,
      face: faceUrl,
      submittedAt: Date.now(),
      reviewedAt: undefined,
      reviewedBy: undefined,
      reason: undefined,
    };

    await user.save();

    const formatted = formatUser(user);
    notify.userUpdated(formatted);

    return res.json({ ok: true, msg: "KYC submitted — awaiting review", user: formatted });
  } catch (err) {
    console.error("Submit KYC error:", err);
    return res.status(500).json({ ok: false, msg: "Could not submit KYC" });
  }
};

exports.approveKyc = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found" });

    user.kyc = {
      ...user.kyc.toObject ? user.kyc.toObject() : user.kyc,
      status: "approved",
      reviewedAt: Date.now(),
      reviewedBy: req.user?.fname ? `${req.user.fname} ${req.user.lname}` : "Staff",
      reason: undefined,
    };

    await user.save();
    const formatted = formatUser(user);
    notify.userUpdated(formatted);
    return res.json({ ok: true, msg: "KYC approved", user: formatted });
  } catch (err) {
    console.error("Approve KYC error:", err);
    return res.status(500).json({ ok: false, msg: "Could not approve KYC" });
  }
};

exports.rejectKyc = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found" });

    user.kyc = {
      ...user.kyc.toObject ? user.kyc.toObject() : user.kyc,
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: req.user?.fname ? `${req.user.fname} ${req.user.lname}` : "Staff",
      reason: req.body.reason || "KYC rejected",
    };

    await user.save();
    const formatted = formatUser(user);
    notify.userUpdated(formatted);
    return res.json({ ok: true, msg: "KYC rejected", user: formatted });
  } catch (err) {
    console.error("Reject KYC error:", err);
    return res.status(500).json({ ok: false, msg: "Could not reject KYC" });
  }
};
