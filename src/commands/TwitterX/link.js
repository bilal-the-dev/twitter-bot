const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const crypto = require("crypto");
const TwitterLink = require("../../models/TwitterLink");

module.exports = {
  name: "link",
  description: "Link your Twitter/X account with Discord",
  options: [
    {
      name: "twitter_username",
      description: "Your Twitter/X username (without @)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  /**
   * @param {Client} client
   * @param {Interaction} interaction
   */
  callback: async (client, interaction) => {
    const discordId = interaction.user.id;
    const twitterUsername = interaction.options
      .getString("twitter_username")
      .replace("@", "")
      .toLowerCase();

    await interaction.deferReply({ ephemeral: true });

    /* ======================
       ANTI-ABUSE CHECKS
    ====================== */

    // 1 Discord -> 1 Twitter
    const alreadyLinkedDiscord = await TwitterLink.findOne({
      discordId,
      verified: true,
    });

    if (alreadyLinkedDiscord) {
      return interaction.editReply(
        "❌ Your Discord is already linked to a Twitter account."
      );
    }

    // 1 Twitter -> 1 Discord
    const alreadyLinkedTwitter = await TwitterLink.findOne({
      twitterUsername,
      verified: true,
    });

    if (alreadyLinkedTwitter) {
      return interaction.editReply(
        "❌ This Twitter account is already linked to another Discord user."
      );
    }

    // Prevent spam re-requests
    const existingPending = await TwitterLink.findOne({
      discordId,
      verified: false,
    });

    if (existingPending) {
      return interaction.editReply(
        "⚠️ You already have a pending verification. Please verify or wait for it to expire."
      );
    }

    /* ======================
       CREATE VERIFICATION
    ====================== */

    const verificationCode =
      "TW-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const link = await TwitterLink.create({
      discordId,
      twitterUsername,
      verificationCode,
      expiresAt,
    });

    /* ======================
       EMBED + BUTTON
    ====================== */

    const embed = new EmbedBuilder()
      .setColor("#1DA1F2")
      .setTitle("🔗 Link Twitter Account")
      .setDescription(
        `To verify ownership of **@${twitterUsername}**, follow the steps below:`
      )
      .addFields(
        {
          name: "1️⃣ Add this code to your Twitter bio",
          value: `\`\`\`${verificationCode}\`\`\``,
        },
        {
          name: "2️⃣ Time limit",
          value: "⏱️ You have **5 minutes** to complete verification.",
        },
        {
          name: "3️⃣ Verify",
          value: "After updating your bio, click **Verify** below.",
        }
      )
      .setFooter({
        text: "Your Twitter profile must be public",
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`verifyTwitter_${link._id}`)
        .setLabel("Verify")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  },
};
