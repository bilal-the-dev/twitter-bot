const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");
const Project = require("../../models/Project");
const Tweet = require("../../models/Tweet");

module.exports = {
  name: "tweet",
  description: "Send a tweet for engagement (Admin only)",
  options: [
    {
      name: "send",
      description: "Send a new tweet for engagement",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "url",
          description: "The tweet URL",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "text",
          description: "Optional description for Discord embed",
          type: ApplicationCommandOptionType.String,
        },
      ],
    },
  ],

  callback: async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "send") {
      const url = interaction.options.getString("url");
      const text =
        interaction.options.getString("text") || "Engage with this tweet!";

      // Extract tweet ID from URL
      const tweetIdMatch = url.match(/status\/(\d+)/);
      if (!tweetIdMatch) {
        return interaction.reply({
          content:
            "❌ Invalid tweet URL. Please provide a valid Twitter tweet link.",
          ephemeral: true,
        });
      }
      const tweetId = tweetIdMatch[1];

      // Check running project
      const project = await Project.findOne({ status: "running" });
      if (!project) {
        return interaction.reply({
          content: "❌ No project is currently running. Start a project first.",
          ephemeral: true,
        });
      }

      //   // 24h expiry
      //   const sentAt = new Date();
      //   const expiresAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000); // 24h

      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + 1 * 60 * 1000); // 3 minutes

      // Create tweet record
      const tweet = await Tweet.create({
        projectId: project._id,
        tweetText: text,
        tweetId,
        authorId: interaction.user.id,
        sentAt,
        expiresAt,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("❤️")
          .setStyle(ButtonStyle.Link)
          .setURL(url),

        new ButtonBuilder()
          .setLabel("💬")
          .setStyle(ButtonStyle.Link)
          .setURL(url),

        new ButtonBuilder()
          .setLabel("🔁")
          .setStyle(ButtonStyle.Link)
          .setURL(url),

        new ButtonBuilder()
          .setCustomId(`doneTweet_${tweet._id}`)
          .setLabel("Done")
          .setStyle(ButtonStyle.Success)
      );

      // Send embed
      const embed = new EmbedBuilder()
        .setTitle("📢 New Tweet for Engagement!")
        .setColor("Blue")
        .setDescription(text)
        .addFields(
          { name: "Project", value: project.name },
          { name: "Tweet URL", value: `[Click here](${url})` },
          { name: "Expires", value: expiresAt.toUTCString() }
        )
        .setFooter({ text: `Posted by ${interaction.user.tag}` });

      const message = await interaction.reply({
        embeds: [embed],
        components: [row],
        fetchReply: true,
      });

      // Save embedMessageId
      tweet.embedMessageId = message.id;
      await tweet.save();
    }
  },
};
