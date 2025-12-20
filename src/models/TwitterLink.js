const mongoose = require("mongoose");

const twitterLinkSchema = new mongoose.Schema(
  {
    discordId: {
      type: String,
      required: true,
      index: true,
    },

    twitterUsername: {
      type: String,
      required: true,
      lowercase: true,
      index: true,
    },

    verificationCode: {
      type: String,
      required: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TwitterLink", twitterLinkSchema);
