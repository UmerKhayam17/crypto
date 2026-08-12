const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const User = require("../model/User");
const formatUser = require("../utils/formatUser");
const { randomUploadName } = require("../utils/uploadNames");
const notify = require("../utils/realtimeNotify");

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/** Max CNIC image upload size before conversion */
const MAX_KYC_IMAGE_BYTES = 10 * 1024 * 1024;
/** Longest edge after resize (keeps CNIC readable, reduces storage) */
const MAX_KYC_EDGE = 2000;

async function assertKycAccess(actor, targetUser) {
  if (!targetUser || targetUser.role !== "user") return false;
  if (actor.role === "admin") return true;
  if (actor.role !== "staff") return false;
  return String(targetUser.assignedStaff) === String(actor._id);
}

/**
 * Compress an uploaded image, convert to WebP, and write under uploads/.
 * Returns the stored filename.
 */
async function saveKycImageAsWebp(file, prefix) {
  if (!file?.buffer || !file.buffer.length) {
    throw new Error(`Empty upload: ${prefix}`);
  }
  if (file.buffer.length > MAX_KYC_IMAGE_BYTES) {
    const err = new Error("Image too large (max 10 MB)");
    err.code = "IMAGE_TOO_LARGE";
    throw err;
  }

  let webp;
  try {
    webp = await sharp(file.buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_KYC_EDGE,
        height: MAX_KYC_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 5 })
      .toBuffer();
  } catch {
    const err = new Error("Could not process image — use JPG, PNG, or WebP");
    err.code = "IMAGE_CONVERT_FAILED";
    throw err;
  }

  const filename = randomUploadName(prefix, "image.webp", "image/webp", ".webp");
  fs.writeFileSync(path.join(uploadDir, filename), webp);
  return filename;
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

    const frontSaved = await saveKycImageAsWebp(frontFile, "kyc-front");
    const backSaved = await saveKycImageAsWebp(backFile, "kyc-back");

    const host = req.get("host");
    const protocol = req.protocol;
    const frontUrl = `${protocol}://${host}/api/media/${frontSaved}`;
    const backUrl = `${protocol}://${host}/api/media/${backSaved}`;

    user.kyc = {
      ...(user.kyc.toObject ? user.kyc.toObject() : user.kyc),
      status: "pending",
      cnicFront: frontUrl,
      cnicBack: backUrl,
      face: "",
      submittedAt: Date.now(),
      reviewedAt: undefined,
      reviewedBy: undefined,
      reason: undefined,
    };

    await user.save();

    const formatted = formatUser(user);
    const staffView = formatUser(user, { staff: true });
    notify.userUpdated(staffView);

    return res.json({ ok: true, msg: "KYC submitted — awaiting review", user: formatted });
  } catch (err) {
    console.error("Submit KYC error:", err);
    if (err.code === "IMAGE_TOO_LARGE") {
      return res.status(400).json({ ok: false, msg: err.message });
    }
    if (err.code === "IMAGE_CONVERT_FAILED") {
      return res.status(400).json({ ok: false, msg: err.message });
    }
    return res.status(500).json({
      ok: false,
      msg: err.message?.includes("Empty upload")
        ? "Image upload was empty — please try again"
        : "Could not submit KYC",
    });
  }
};

exports.approveKyc = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ ok: false, msg: "User not found" });

    const allowed = await assertKycAccess(req.user, user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this user" });

    user.kyc = {
      ...(user.kyc.toObject ? user.kyc.toObject() : user.kyc),
      status: "approved",
      reviewedAt: Date.now(),
      reviewedBy: req.user?.fname ? `${req.user.fname} ${req.user.lname}` : "Staff",
      reason: undefined,
    };

    await user.save();
    const formatted = formatUser(user, { staff: true });
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

    const allowed = await assertKycAccess(req.user, user);
    if (!allowed) return res.status(403).json({ ok: false, msg: "Not authorized for this user" });

    user.kyc = {
      ...(user.kyc.toObject ? user.kyc.toObject() : user.kyc),
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: req.user?.fname ? `${req.user.fname} ${req.user.lname}` : "Staff",
      reason: req.body.reason || "KYC rejected",
    };

    await user.save();
    const formatted = formatUser(user, { staff: true });
    notify.userUpdated(formatted);
    return res.json({ ok: true, msg: "KYC rejected", user: formatted });
  } catch (err) {
    console.error("Reject KYC error:", err);
    return res.status(500).json({ ok: false, msg: "Could not reject KYC" });
  }
};
