const mongoose = require("mongoose");

const tweetParticipationSchema = new mongoose.Schema(
  {
    tweetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tweet",
      required: true,
      index: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

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

    doneAt: {
      type: Date,
      default: Date.now,
    },

    eligible: {
      type: Boolean,
      default: true, // cron may set false later
    },

    pointsAssigned: {
      type: Boolean,
      default: false,
    },

    liked: {
      type: Boolean,
      default: false,
    },

    retweeted: {
      type: Boolean,
      default: false,
    },

    replied: {
      type: Boolean,
      default: false,
    },

    earlyBonus: {
      type: Boolean,
      default: false,
    },

    earnedPoints: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Prevent duplicates (VERY IMPORTANT)
tweetParticipationSchema.index({ tweetId: 1, discordId: 1 }, { unique: true });

module.exports = mongoose.model("TweetParticipation", tweetParticipationSchema);
