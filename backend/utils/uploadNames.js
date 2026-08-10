const crypto = require("crypto");
const path = require("path");

function randomUploadName(prefix, originalName, mime = "", forcedExt) {
  const extFromMime = () => {
    if (mime.includes("png")) return ".png";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("gif")) return ".gif";
    if (mime.includes("mp4")) return ".mp4";
    if (mime.includes("quicktime")) return ".mov";
    if (mime.includes("webm")) return ".webm";
    if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
    return "";
  };
  const ext =
    forcedExt ||
    path.extname(originalName || "") ||
    extFromMime() ||
    ".bin";
  const id = crypto.randomBytes(18).toString("hex");
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${prefix}-${id}${safeExt}`;
}

module.exports = { randomUploadName };
