const normalizeId = require("./normalizeId");

function formatDeposit(doc) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  const userId = normalizeId(json.user) || normalizeId(json.userId) || "";

  return {
    id: json.id || json._id?.toString(),
    userId,
    amount: json.amount,
    txHash: json.txHash || undefined,
    screenshot: json.screenshot,
    note: json.note || undefined,
    status: json.status,
    rejectReason: json.rejectReason || undefined,
    processedBy: json.processedBy || undefined,
    createdAt: json.createdAt ? new Date(json.createdAt).getTime() : Date.now(),
    processedAt: json.processedAt || undefined,
  };
}

module.exports = formatDeposit;
