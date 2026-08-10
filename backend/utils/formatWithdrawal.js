const normalizeId = require("./normalizeId");

function formatWithdrawal(doc) {
  const json = doc.toJSON ? doc.toJSON() : doc;
  const userId = normalizeId(json.user) || normalizeId(json.userId) || "";

  return {
    id: json.id || json._id?.toString(),
    userId,
    amount: json.amount,
    method: json.method,
    trc20Address: json.trc20Address || undefined,
    bankName: json.bankName || undefined,
    accountNumber: json.accountNumber || undefined,
    accountName: json.accountName || undefined,
    note: json.note || undefined,
    status: json.status,
    rejectReason: json.rejectReason || undefined,
    processedBy: json.processedBy || undefined,
    createdAt: json.createdAt ? new Date(json.createdAt).getTime() : Date.now(),
    processedAt: json.processedAt || undefined,
  };
}

module.exports = formatWithdrawal;
