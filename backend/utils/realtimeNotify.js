const { emitPublic, emitUserScoped, emitStaffAdmin, emitAdmin } = require("../ws/realtime");
const normalizeId = require("./normalizeId");

exports.settingsUpdated = (walletAddress, payoutPercent, spotFeePercent) => {
  emitPublic("settings:updated", { walletAddress, payoutPercent, spotFeePercent });
};

exports.userUpdated = (user) => {
  const userId = normalizeId(user.id) || normalizeId(user._id);
  if (!userId) return;
  emitUserScoped("user:updated", { user }, userId);
};

exports.usersInvalidate = () => {
  emitStaffAdmin("users:invalidate", {});
};

exports.depositUpsert = (deposit, extra = {}) => {
  const userId = normalizeId(deposit.userId) || normalizeId(extra.userId);
  if (!userId) return;
  emitUserScoped("deposit:upsert", { deposit, ...extra }, userId);
};

exports.depositDeleted = (id, userId) => {
  const uid = normalizeId(userId);
  if (!uid) return;
  emitUserScoped("deposit:deleted", { id }, uid);
};

exports.withdrawalUpsert = (withdrawal, extra = {}) => {
  const userId = normalizeId(withdrawal.userId) || normalizeId(extra.userId);
  if (!userId) return;
  emitUserScoped("withdrawal:upsert", { withdrawal, ...extra }, userId);
};

exports.withdrawalDeleted = (id, userId) => {
  const uid = normalizeId(userId);
  if (!uid) return;
  emitUserScoped("withdrawal:deleted", { id }, uid);
};

exports.tradeUpsert = (trade, extra = {}) => {
  const userId = normalizeId(trade.userId) || normalizeId(extra.userId);
  if (!userId) return;
  emitUserScoped("trade:upsert", { trade, ...extra }, userId);
};

exports.tradeDeleted = (id, userId) => {
  const uid = normalizeId(userId);
  if (!uid) return;
  emitUserScoped("trade:deleted", { id }, uid);
};

exports.tradesCleared = () => {
  emitStaffAdmin("trades:cleared", {});
};

exports.staffUpsert = (staff) => {
  emitAdmin("staff:upsert", { staff });
};

exports.staffDeleted = (id) => {
  emitAdmin("staff:deleted", { id });
  emitStaffAdmin("users:invalidate", {});
};

exports.supportMessageUpsert = (thread, message, extra = {}) => {
  const userId =
    normalizeId(thread?.userId) ||
    normalizeId(thread?.user) ||
    normalizeId(extra.userId) ||
    normalizeId(extra.threadUserId);
  if (!userId) return;
  emitUserScoped("support:message", { thread, message, ...extra }, userId);
};

exports.spotUpsert = (position, extra = {}) => {
  const userId = normalizeId(position.userId) || normalizeId(extra.userId);
  if (!userId) return;
  emitUserScoped("spot:upsert", { position, ...extra }, userId);
};
