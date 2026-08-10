const mongoose = require("mongoose");

const vipClaimSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    level: { type: Number, required: true, min: 1, max: 6 },
    name: { type: String, required: true },
    requiredRecharge: { type: Number, required: true },
    reward: { type: Number, required: true },
    totalRechargeAtClaim: { type: Number, required: true },
    claimedAt: { type: Number, required: true },
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

vipClaimSchema.index({ user: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("VipClaim", vipClaimSchema);
