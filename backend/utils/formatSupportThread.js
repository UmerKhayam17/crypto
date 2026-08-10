const normalizeId = require("./normalizeId");

function toMs(value) {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : undefined;
}

function formatSupportThread(doc) {
  const json = doc?.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id || json._id?.toString(),
    userId: normalizeId(json.userId) || normalizeId(json.user?._id) || normalizeId(json.user),
    status: json.status,
    createdAt: toMs(json.createdAt),
    updatedAt: toMs(json.updatedAt),
    user: json.user
      ? {
          id: normalizeId(json.user.id || json.user._id) || "",
          name: json.user.name || `${json.user.fname ?? ""} ${json.user.lname ?? ""}`.trim() || undefined,
          email: json.user.email,
        }
      : undefined,
  };
}

module.exports = formatSupportThread;
