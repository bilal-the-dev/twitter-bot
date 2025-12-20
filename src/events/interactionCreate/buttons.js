const Tweet = require("../../models/Tweet");
const TweetParticipation = require("../../models/TweetParticipation");
const TwitterLink = require("../../models/TwitterLink");
const axios = require("axios");

module.exports = async (client, interaction) => {
  if (!interaction.isButton()) return;

  // Split customId by "_"
  const [action, type, id] = interaction.customId.split("_");
  console.log(action);
  switch (action) {
    case "verifyTwitter":
      await handleTwitterVerify(interaction, type);
      break;

    case "doneTweet":
      await handleDoneTweet(interaction, type);
      break;

    default:
      return;
  }
};

async function handleTwitterVerify(interaction, recordId) {
  const discordId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // Fetch pending record
  const record = recordId
    ? await TwitterLink.findById(recordId)
    : await TwitterLink.findOne({ discordId, verified: false });

  if (!record) {
    return interaction.editReply(
      "❌ No pending Twitter verification found. Please run `/link` again."
    );
  }

  // Ensure same user
  if (record.discordId !== discordId) {
    return interaction.editReply("❌ This verification is not for you.");
  }

  // Expiry check
  if (record.expiresAt < new Date()) {
    return interaction.editReply(
      "⏱️ Verification expired. Please run `/link` again."
    );
  }

  // =========================
  // Call Twitter API using Axios
  // =========================
  const apiKey = process.env.TWITTER_API_KEY;
  const twitterUsername = record.twitterUsername;

  try {
    const response = await axios.get(
      "https://api.twitterapi.io/twitter/user/info",
      {
        headers: {
          "X-API-Key": apiKey,
        },
        params: {
          userName: twitterUsername,
        },
      }
    );

    const data = response.data;
    console.log(data);
    if (!data || !data.data) {
      return interaction.editReply(
        "❌ Could not fetch Twitter user data. Please check the username."
      );
    }

    const profileBio = data.data.description || "";
    console.log(profileBio);
    // =========================
    // Check if verification code exists in bio
    // =========================
    if (!profileBio.includes(record.verificationCode)) {
      return interaction.editReply(
        "❌ Verification code not found in your Twitter bio. Please add it and try again."
      );
    }

    // =========================
    // Success - mark verified
    // =========================
    record.verified = true;
    await record.save();

    return interaction.editReply(
      `✅ Twitter account **@${twitterUsername}** successfully verified!`
    );
  } catch (err) {
    console.error("Twitter verify error:", err);

    if (err.response && err.response.data) {
      return interaction.editReply(
        `❌ Twitter API error: ${err.response.status} ${
          err.response.data.message || ""
        }`
      );
    }

    return interaction.editReply(
      "❌ Something went wrong while verifying your Twitter account. Try again later."
    );
  }
}

async function handleDoneTweet(interaction, tweetRecordId) {
  const discordId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // 1. Check Twitter link
  const twitterLink = await TwitterLink.findOne({
    discordId,
    verified: true,
  });

  console.log(twitterLink);

  if (!twitterLink) {
    return interaction.editReply(
      "❌ You must link and verify your Twitter account first using `/link`."
    );
  }

  // 2. Fetch tweet
  const tweet = await Tweet.findById(tweetRecordId);

  if (!tweet) {
    return interaction.editReply("❌ Tweet not found.");
  }

  // 3. Expiry check
  if (tweet.expiresAt < new Date()) {
    return interaction.editReply(
      "⏱️ This tweet has expired. Engagement window is closed."
    );
  }

  // 4. Save participation
  try {
    await TweetParticipation.create({
      tweetId: tweet._id,
      projectId: tweet.projectId,
      discordId,
      twitterUsername: twitterLink.twitterUsername,
    });
  } catch (err) {
    // Duplicate protection
    if (err.code === 11000) {
      return interaction.editReply(
        "⚠️ You have already marked this tweet as done."
      );
    }
    throw err;
  }

  return interaction.editReply(
    "✅ Done! Your engagement has been recorded.\nPoints will be assigned after verification."
  );
}
