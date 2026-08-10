const normalizeId = require("./normalizeId");

function formatSupportMessage(doc) {
  const json = doc?.toJSON ? doc.toJSON() : doc;
  return {
    id: json.id || json._id?.toString(),
    threadId: normalizeId(json.threadId || json.thread) || normalizeId(json.thread?._id) || "",
    senderId: normalizeId(json.senderId || json.sender) || normalizeId(json.sender?._id) || "",
    senderRole: json.senderRole,
    content: json.content,
    createdAt: json.createdAt,
  };
}

module.exports = formatSupportMessage;

