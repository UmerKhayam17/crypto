const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: { type: String, required: true },
    direction: { type: String, enum: ["up", "down"], required: true },
    stake: { type: Number, required: true, min: 0.01 },
    durationSec: { type: Number, required: true },
    entryPrice: { type: Number, required: true },
    openedAt: { type: Number, required: true },
    expiresAt: { type: Number, required: true, index: true },
    status: {
      type: String,
      enum: ["active", "settling", "won", "lost"],
      default: "active",
      index: true,
    },
    closePrice: { type: Number },
    payout: { type: Number },
    pnl: { type: Number },
    resolvedAt: { type: Number },
    outcomeSource: {
      type: String,
      enum: ["random", "market", "forced-win", "forced-loss", "admin", "planned", "user-close"],
      default: "random",
    },
    plannedOutcome: {
      type: String,
      enum: ["profit", "loss"],
      default: null,
    },
    customProfitPercent: { type: Number },
    customLossPercent: { type: Number },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Trade", tradeSchema);
