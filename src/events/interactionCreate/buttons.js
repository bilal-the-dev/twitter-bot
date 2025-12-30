const { EmbedBuilder } = require("discord.js");
const Tweet = require("../../models/Tweet");
const TweetParticipation = require("../../models/TweetParticipation");
const TwitterLink = require("../../models/TwitterLink");
const axios = require("axios");

module.exports = async (client, interaction) => {
  if (!interaction.isButton()) return;

  // Split customId by "_"
  const [action, type, id] = interaction.customId.split("_");
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

  /* ======================
     FETCH PENDING RECORD
  ====================== */
  const record = recordId
    ? await TwitterLink.findById(recordId)
    : await TwitterLink.findOne({ discordId, verified: false });

  if (!record) {
    return interaction.editReply(
      "❌ No pending Twitter verification found. Please run `/link` again."
    );
  }

  /* ======================
     SECURITY CHECKS
  ====================== */

  if (record.discordId !== discordId) {
    return interaction.editReply("❌ This verification is not for you.");
  }

  if (record.verified) {
    const successEmbed = new EmbedBuilder()
      .setColor("#00FF00")
      .setTitle("✅ Already Verified")
      .setDescription(
        `Your Discord account is already linked to **@${record.twitterUsername}**`
      )
      .setFooter({ text: "To unlink, use /unlink command" });

    return interaction.editReply({ embeds: [successEmbed] });
  }

  if (record.expiresAt < new Date()) {
    await TwitterLink.deleteOne({ _id: record._id });
    return interaction.editReply(
      "⏱️ Verification expired. Please run `/link` again to get a new verification code."
    );
  }

  /* ======================
     CHECK IF TWITTER ALREADY LINKED
  ====================== */

  const alreadyLinkedTwitter = await TwitterLink.findOne({
    twitterUsername: record.twitterUsername,
    verified: true,
    _id: { $ne: record._id },
  });

  if (alreadyLinkedTwitter) {
    await TwitterLink.deleteOne({ _id: record._id });
    return interaction.editReply(
      "❌ This Twitter account is already linked to another Discord user."
    );
  }

  /* ======================
     CALL NEW TWITTER API
  ====================== */
  try {
    const params = new URLSearchParams({
      username: record.twitterUsername, // no @
    });

    const response = await fetch(
      `https://api.tweetapi.com/tw-v2/user/by-username?${params}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": process.env.TWITTER_API_KEY,
        },
      }
    );

    const data = await response.json();

    if (!data || !data.data) {
      return interaction.editReply(
        "❌ Could not fetch Twitter user data. Please check if the username is correct and the profile is public."
      );
    }

    const profileBio = data.data.bio || "";
    console.log(profileBio);
    /* ======================
       VERIFY CODE IN BIO
    ====================== */
    if (!profileBio.includes(record.verificationCode)) {
      const retryEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setTitle("❌ Verification Failed")
        .setDescription(
          `The verification code was not found in **@${record.twitterUsername}**'s bio.`
        )
        .addFields(
          {
            name: "Required Code",
            value: `\`\`\`${record.verificationCode}\`\`\``,
          },
          {
            name: "What to do?",
            value:
              "1. Add the code to your Twitter bio\n2. Make sure your profile is public\n3. Click **Verify** again",
          },
          {
            name: "Time Remaining",
            value: `⏱️ Expires <t:${Math.floor(
              record.expiresAt.getTime() / 1000
            )}:R>`,
          }
        );

      return interaction.editReply({
        embeds: [retryEmbed],
      });
    }

    /* ======================
       SUCCESS - MARK VERIFIED
    ====================== */
    record.verified = true;
    await record.save();

    const successEmbed = new EmbedBuilder()
      .setColor("#00FF00")
      .setTitle("✅ Verification Successful!")
      .setDescription(
        `Your Discord account has been successfully linked to **@${record.twitterUsername}**`
      )
      .addFields({
        name: "📝 Next Steps",
        value:
          "You can now remove the verification code from your Twitter bio.",
      })
      .setFooter({ text: "To unlink, use /unlink command" })
      .setTimestamp();

    return interaction.editReply({
      embeds: [successEmbed],
      components: [],
    });
  } catch (err) {
    console.error("Twitter verify error:", err);
    return interaction.editReply(
      "❌ Something went wrong while verifying your Twitter account. Please try again later."
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
