const Tweet = require("../models/Tweet");
const TweetParticipation = require("../models/TweetParticipation");
const UserProfile = require("../models/UserProfile");
const pointsConfig = require("../../config.json");
const { getAllRetweeters, getAllReplies } = require("./twitterApi");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return 5000 + Math.floor(Math.random() * 3000);
}

async function assignTweetPointsCron(client) {
  console.log("[CRON] Running tweet points assignment...");

  const now = new Date();

  const tweets = await Tweet.find({
    expiresAt: { $lt: now },
    pointsAssigned: false,
  });

  for (const tweet of tweets) {
    console.log(`[CRON] Processing tweet ${tweet.tweetId}`);

    let retweeters = new Set();
    let repliers = new Set();

    try {
      retweeters = await getAllRetweeters(tweet.tweetId);
    } catch (e) {
      console.error("Retweet fetch failed:", e);
    }

    try {
      await sleep(randomDelay());
      repliers = await getAllReplies(tweet.tweetId);
    } catch (e) {
      console.error("Reply fetch failed:", e);
    }

    const participants = await TweetParticipation.find({
      tweetId: tweet._id,
      pointsAssigned: false,
      eligible: true,
    });

    if (participants.length === 0) continue;

    for (const participant of participants) {
      let earnedPoints = 0;

      let liked = true; // participation implies like
      let retweeted = false;
      let replied = false;
      let earlyBonus = false;

      let didRealAction = false;

      // 👍 LIKE
      earnedPoints += pointsConfig.LIKE;

      // 🔁 RETWEET
      if (retweeters.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.RETWEET;
        retweeted = true;
        didRealAction = true;
      }

      // 💬 REPLY
      if (repliers.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.REPLY;
        replied = true;
        didRealAction = true;
      }

      // Skip if no real engagement
      if (!didRealAction) continue;

      // ⏱ Early Bonus
      const participationTime = participant.createdAt;
      const tweetSentTime = tweet.sentAt;
      const diffMinutes = (participationTime - tweetSentTime) / (1000 * 60);

      if (diffMinutes <= pointsConfig.EARLY_WINDOW_MINUTES) {
        earnedPoints += pointsConfig.EARLY_BONUS;
        earlyBonus = true;
      }

      // Fetch Discord username
      const discordUsername = await fetchDiscordUsername(
        client,
        participant.discordId,
      );

      // Update / Create UserProfile
      const userProfile = await UserProfile.findOneAndUpdate(
        { discordId: participant.discordId },
        {
          $setOnInsert: {
            discordId: participant.discordId,
            twitterUsername: participant.twitterUsername,
          },
          $inc: { totalPoints: earnedPoints },
          $set: {
            username: discordUsername ?? null,
            lastUpdatedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      const projectIndex = userProfile.projectPoints.findIndex(
        (p) => p.projectId.toString() === tweet.projectId.toString(),
      );

      if (projectIndex === -1) {
        userProfile.projectPoints.push({
          projectId: tweet.projectId,
          points: earnedPoints,
        });
      } else {
        userProfile.projectPoints[projectIndex].points += earnedPoints;
      }

      await userProfile.save();

      // Save action data in participation
      participant.liked = liked;
      participant.retweeted = retweeted;
      participant.replied = replied;
      participant.earlyBonus = earlyBonus;
      participant.earnedPoints = earnedPoints;
      participant.pointsAssigned = true;

      await participant.save();

      // 📩 DM USER RESULTS
      try {
        const user = await client.users.fetch(participant.discordId);

        if (user) {
          const likePoints = pointsConfig.LIKE;
          const retweetPoints = retweeted ? pointsConfig.RETWEET : 0;
          const replyPoints = replied ? pointsConfig.REPLY : 0;
          const earlyPoints = earlyBonus ? pointsConfig.EARLY_BONUS : 0;

          const resultMessage =
            `📊 **Tweet Results**\n\n` +
            `Tweet: https://twitter.com/i/status/${tweet.tweetId}\n\n` +
            `👍 Like: +${likePoints} pts\n` +
            `🔁 Retweet: +${retweetPoints} pts\n` +
            `💬 Reply: +${replyPoints} pts\n` +
            `⚡ Early Bonus: +${earlyPoints} pts\n\n` +
            `🏆 **Total Earned: ${earnedPoints} points**\n\n` +
            `Keep engaging to earn more rewards! 🚀`;

          await user.send(resultMessage);
        }
      } catch (dmError) {
        console.log(
          `[CRON] Could not DM user ${participant.discordId}:`,
          dmError.message,
        );
      }
    }

    // Mark tweet completed
    tweet.pointsAssigned = true;
    tweet.status = "completed";
    await tweet.save();
  }

  console.log("[CRON] Tweet points assignment completed.");
}

async function fetchDiscordUsername(client, discordId) {
  try {
    const user = await client.users.fetch(discordId);
    return `${user.username}`;
  } catch (err) {
    console.warn(
      `[CRON] Failed to fetch Discord user ${discordId}:`,
      err.message,
    );
    return null;
  }
}

module.exports = assignTweetPointsCron;
