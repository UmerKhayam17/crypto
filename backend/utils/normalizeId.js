const { Types } = require("mongoose");

/** Coerce MongoDB ids (string, ObjectId, Buffer, populated doc) to a 24-char hex string. */
function normalizeId(value) {
  if (value == null || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^[a-f\d]{24}$/i.test(trimmed) ? trimmed : null;
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    try {
      return new Types.ObjectId(value).toString();
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    if (value._id != null) {
      const fromId = normalizeId(value._id);
      if (fromId) return fromId;
    }
    if (typeof value.id === "string") {
      const fromId = normalizeId(value.id);
      if (fromId) return fromId;
    }
    if (typeof value.toString === "function") {
      const s = value.toString();
      if (/^[a-f\d]{24}$/i.test(s)) return s;
    }
  }

  return null;
}

module.exports = normalizeId;
