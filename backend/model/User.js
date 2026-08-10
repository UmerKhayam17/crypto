const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const kycSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    cnicFront: String,
    cnicBack: String,
    face: String,
    submittedAt: Number,
    reviewedAt: Number,
    reviewedBy: String,
    reason: String,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    fname: { type: String, required: true, trim: true },
    lname: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    country: { type: String, default: "" },
    role: {
      type: String,
      enum: ["user", "admin", "staff"],
      default: "user",
    },
    suspended: { type: Boolean, default: false },
    forceOutcome: {
      type: String,
      enum: ["random", "win", "lose"],
      default: "random",
    },
    profitPercent: { type: Number, default: null },
    lossPercent: { type: Number, default: 100 },
    kyc: { type: kycSchema, default: () => ({ status: "none" }) },
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    wallet: {
      cashUSDT: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.virtual("name").get(function () {
  return `${this.fname} ${this.lname}`;
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", userSchema);
