const normalizeId = require("./normalizeId");

function toMs(value) {
  if (value == null) return Date.now();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function formatSupportMessage(doc) {
  const json = doc?.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id || json._id?.toString(),
    threadId: normalizeId(json.threadId || json.thread) || normalizeId(json.thread?._id) || "",
    senderId: normalizeId(json.senderId || json.sender) || normalizeId(json.sender?._id) || "",
    senderRole: json.senderRole,
    content: json.content || "",
    image: json.image || "",
    createdAt: toMs(json.createdAt),
    editedAt: json.editedAt ? toMs(json.editedAt) : undefined,
  };
}

module.exports = formatSupportMessage;
