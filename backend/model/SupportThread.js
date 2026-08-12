const mongoose = require("mongoose");

const supportThreadSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },
    /** Per-reader last-seen cursor so unread survives logout / device switch */
    reads: [
      {
        reader: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        at: {
          type: Date,
          required: true,
          default: Date.now,
        },
      },
    ],
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

// One active thread per user is enough for this app; we enforce via query in controller.
supportThreadSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("SupportThread", supportThreadSchema);

