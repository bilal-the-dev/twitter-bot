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
       CHECK IF ALREADY VERIFIED
    ====================== */

    const alreadyLinkedDiscord = await TwitterLink.findOne({
      discordId,
      verified: true,
    });

    if (alreadyLinkedDiscord) {
      const successEmbed = new EmbedBuilder()
        .setColor("#00FF00")
        .setTitle("✅ Already Linked")
        .setDescription(
          `Your Discord account is already linked to **@${alreadyLinkedDiscord.twitterUsername}**`
        );

      return interaction.editReply({
        embeds: [successEmbed],
      });
    }

    /* ======================
       CHECK IF TWITTER TAKEN
    ====================== */

    const alreadyLinkedTwitter = await TwitterLink.findOne({
      twitterUsername,
      verified: true,
    });

    if (alreadyLinkedTwitter) {
      return interaction.editReply(
        "❌ This Twitter account is already linked to another Discord user."
      );
    }

    /* ======================
       CHECK FOR PENDING VERIFICATION
    ====================== */

    let existingPending = await TwitterLink.findOne({
      discordId,
      verified: false,
    });

    // Clean up expired pending requests
    if (existingPending && new Date() > existingPending.expiresAt) {
      await TwitterLink.deleteOne({ _id: existingPending._id });
      existingPending = null;
    }

    let link;
    let verificationCode;

    if (existingPending) {
      // User has a pending verification - show it again
      link = existingPending;
      verificationCode = existingPending.verificationCode;

      const embed = new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle("⚠️ Pending Verification")
        .setDescription(
          `You already have a pending verification for **@${existingPending.twitterUsername}**`
        )
        .addFields(
          {
            name: "1️⃣ Add this code to your Twitter bio",
            value: `\`\`\`${verificationCode}\`\`\``,
          },
          {
            name: "2️⃣ Time remaining",
            value: `⏱️ Expires <t:${Math.floor(
              existingPending.expiresAt.getTime() / 1000
            )}:R>`,
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

      return interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    }

    /* ======================
       CREATE NEW VERIFICATION
    ====================== */

    verificationCode =
      "TW-" + crypto.randomBytes(3).toString("hex").toUpperCase();

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    link = await TwitterLink.create({
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
