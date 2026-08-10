const normalizeId = require("./normalizeId");

function formatSupportThread(doc) {
  const json = doc?.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id || json._id?.toString(),
    userId: normalizeId(json.userId) || normalizeId(json.user?._id) || normalizeId(json.user),
    status: json.status,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
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

