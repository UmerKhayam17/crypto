const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    trc20WalletAddress: { type: String, default: "" },
    payoutPercent: { type: Number, default: 85 },
    /** Spot trading fee percent applied on each side (buy and sell), e.g. 0.1 = 0.1% */
    spotFeePercent: { type: Number, default: 0.1 },
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model("Settings", settingsSchema);
