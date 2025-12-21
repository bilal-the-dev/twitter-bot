const Tweet = require("../models/Tweet");
const TweetParticipation = require("../models/TweetParticipation");
const UserProfile = require("../models/UserProfile");
const pointsConfig = require("../../config.json");
const {
  getAllRetweeters,
  getAllReplies,
  getAllQuotes,
} = require("./twitterApi");
const { EmbedBuilder } = require("discord.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Random delay between 5-8 seconds
function randomDelay() {
  return 5000 + Math.floor(Math.random() * 3000);
}

async function assignTweetPointsCron(client) {
  console.log("[CRON] Running tweet points assignment...");

  const now = new Date();
  const channelId = process.env.TWEET_POINTS_CHANNEL_ID;
  const channel = await client.channels.fetch(channelId);

  const tweets = await Tweet.find({
    expiresAt: { $lt: now },
    pointsAssigned: false,
  });

  for (const tweet of tweets) {
    console.log(`[CRON] Processing tweet ${tweet.tweetId}`);

    let retweeters = new Set();
    let repliers = new Set();
    let quoters = new Set();

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

    try {
      await sleep(randomDelay());
      quoters = await getAllQuotes(tweet.tweetId);
    } catch (e) {
      console.error("Quote fetch failed:", e);
    }

    const participants = await TweetParticipation.find({
      tweetId: tweet._id,
      pointsAssigned: false,
      eligible: true,
    });

    if (participants.length === 0) continue;

    for (const participant of participants) {
      let earnedPoints = 0;
      const actionLines = [];

      // 👍 LIKE (always)
      earnedPoints += pointsConfig.LIKE;
      actionLines.push(`👍 Like      +${pointsConfig.LIKE}`);

      // 🔁 RETWEET
      if (retweeters.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.RETWEET;
        actionLines.push(`🔁 Retweet   +${pointsConfig.RETWEET}`);
      }

      // 💬 REPLY
      if (repliers.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.REPLY;
        actionLines.push(`💬 Reply     +${pointsConfig.REPLY}`);
      }

      // 🧵 QUOTE
      if (quoters.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.QUOTE;
        actionLines.push(`🧵 Quote     +${pointsConfig.QUOTE}`);
      }

      if (earnedPoints === 0) continue;

      const discordUsername = await fetchDiscordUsername(
        client,
        participant.discordId
      );

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
        { upsert: true, new: true }
      );

      const projectIndex = userProfile.projectPoints.findIndex(
        (p) => p.projectId.toString() === tweet.projectId.toString()
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

      participant.pointsAssigned = true;
      await participant.save();

      // ===== CLEAN PER-USER EMBED =====
      const embed = new EmbedBuilder()
        .setColor(0x1da1f2) // Twitter blue
        .setTitle("🏆 Tweet Points Earned")
        .setDescription(
          `**Tweet**\n` +
            `\`https://twitter.com/i/status/${tweet.tweetId}\`\n\n` +
            `**User**\n` +
            `\`${discordUsername || participant.twitterUsername}\`\n\n` +
            `**Actions**\n` +
            `\`\`\`\n${actionLines.join("\n")}\n\`\`\`\n` +
            `**Total**\n` +
            `\`${earnedPoints} points\``
        )
        .setTimestamp();

      if (channel) {
        await channel.send({ embeds: [embed] });
      }
    }

    // Mark tweet done
    tweet.pointsAssigned = true;
    tweet.status = "completed";
    await tweet.save();
  }

  console.log("[CRON] Tweet points assignment completed.");
}

async function fetchDiscordUsername(client, discordId) {
  try {
    const user = await client.users.fetch(discordId);
    // You can choose either format:
    // return user.username;               // simple
    return `${user.username}`; // classic tag
  } catch (err) {
    console.warn(
      `[CRON] Failed to fetch Discord user ${discordId}:`,
      err.message
    );
    return null;
  }
}
module.exports = assignTweetPointsCron;
