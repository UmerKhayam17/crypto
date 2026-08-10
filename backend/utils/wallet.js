const User = require("../model/User");
const Withdrawal = require("../model/Withdrawal");

/** Atomically debit if balance is sufficient. Returns updated user or null. */
async function debitWallet(userId, amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return null;
  return User.findOneAndUpdate(
    { _id: userId, "wallet.cashUSDT": { $gte: amt } },
    { $inc: { "wallet.cashUSDT": -amt } },
    { new: true }
  );
}

/** Atomically credit wallet (floors at applying positive/negative; clamps to >= 0 after). */
async function creditWallet(userId, amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt === 0) {
    return User.findById(userId);
  }
  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { "wallet.cashUSDT": amt } },
    { new: true }
  );
  if (user && (user.wallet?.cashUSDT ?? 0) < 0) {
    user.wallet.cashUSDT = 0;
    await user.save();
  }
  return user;
}

async function getCash(userId) {
  const user = await User.findById(userId).select("wallet");
  return user?.wallet?.cashUSDT ?? 0;
}

module.exports = {
  debitWallet,
  creditWallet,
  getCash,
};
