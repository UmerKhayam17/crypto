const mongoose = require("mongoose");

const spotPositionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    symbol: { type: String, required: true },
    /** buy = long (buy open / sell close), sell = short (sell open / buy close) */
    side: { type: String, enum: ["buy", "sell"], default: "buy", index: true },
    quantity: { type: Number, required: true, min: 0.00000001 },
    entryPrice: { type: Number, required: true, min: 0 },
    entryFee: { type: Number, required: true, min: 0 },
    /** USDT locked on open: entryPrice * quantity + entryFee */
    cost: { type: Number, required: true, min: 0 },
    openedAt: { type: Number, required: true },
    status: {
      type: String,
      enum: ["open", "closing", "closed"],
      default: "open",
      index: true,
    },
    exitPrice: { type: Number },
    exitFee: { type: Number },
    /** USDT returned on close: cost + pnl */
    proceeds: { type: Number },
    pnl: { type: Number },
    pnlPercent: { type: Number },
    closedAt: { type: Number },
    // Legacy fields kept for older long-only records
    buyPrice: { type: Number },
    buyFee: { type: Number },
    sellPrice: { type: Number },
    sellFee: { type: Number },
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

module.exports = mongoose.model("SpotPosition", spotPositionSchema);
