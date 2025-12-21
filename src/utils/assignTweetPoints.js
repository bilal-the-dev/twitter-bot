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
  const channelId = process.env.TWEET_POINTS_CHANNEL_ID; // get from env
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
      console.error(e);
    }

    try {
      await sleep(randomDelay());
      repliers = await getAllReplies(tweet.tweetId);
    } catch (e) {
      console.error(e);
    }

    try {
      await sleep(randomDelay());
      quoters = await getAllQuotes(tweet.tweetId);
    } catch (e) {
      console.error("[CRON] Quote fetch failed:", e.message);
    }

    const participants = await TweetParticipation.find({
      tweetId: tweet._id,
      pointsAssigned: false,
      eligible: true,
    });

    if (participants.length === 0) continue;

    const embed = new EmbedBuilder()
      .setTitle(`Tweet Points Summary`)
      .setDescription(
        `Results for tweet: [View Tweet](https://twitter.com/i/status/${tweet.tweetId})`
      )
      .setColor(0x00ff00)
      .setTimestamp();

    for (const participant of participants) {
      let earnedPoints = 0;
      let details = [];

      // 👍 LIKE (always)
      earnedPoints += pointsConfig.LIKE;
      details.push(`👍 Like: ${pointsConfig.LIKE} pts`);

      // 🔁 RETWEET
      if (retweeters.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.RETWEET;
        details.push(`🔁 Retweet: ${pointsConfig.RETWEET} pts`);
      }

      // 💬 REPLY
      if (repliers.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.REPLY;
        details.push(`💬 Reply: ${pointsConfig.REPLY} pts`);
      }

      // 🧵 QUOTE
      if (quoters.has(participant.twitterUsername)) {
        earnedPoints += pointsConfig.QUOTE;
        details.push(`🧵 Quote: ${pointsConfig.QUOTE} pts`);
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
          $inc: {
            totalPoints: earnedPoints,
          },
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

      // Add user details to embed
      embed.addFields({
        name: discordUsername || participant.twitterUsername,
        value: `${details.join("\n")}\n**Total:** ${earnedPoints} pts`,
      });
    }

    // Mark tweet as completed
    tweet.pointsAssigned = true;
    tweet.status = "completed";
    await tweet.save();

    // Send embed to Discord
    if (channel) {
      await channel.send({ embeds: [embed] });
    }
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
