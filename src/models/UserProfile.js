const mongoose = require("mongoose");

const projectPointsSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    points: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const userProfileSchema = new mongoose.Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    username: {
      type: String,
      required: false, // ✅ NOT required
      default: null,
    },

    twitterUsername: {
      type: String,
      lowercase: true,
      index: true,
    },

    totalPoints: {
      type: Number,
      default: 0,
    },

    projectPoints: [projectPointsSchema],

    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserProfile", userProfileSchema);
