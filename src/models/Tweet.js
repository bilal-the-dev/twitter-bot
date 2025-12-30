const mongoose = require("mongoose");

const tweetSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    tweetId: {
      type: String, // Extracted from tweet URL
      required: true,
    },
    authorId: {
      type: String, // Admin who posted
      required: true,
    },
    embedMessageId: {
      type: String, // Discord message ID of the embed
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date, // 24h after sentAt
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    pointsAssigned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Tweet", tweetSchema);
