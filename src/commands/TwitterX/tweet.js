const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
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
          name: "project_name",
          description: "Specify the project under which this tweet belongs",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "url",
          description: "The tweet URL",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
  ],
  callback: async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "send") {
      const projectName = interaction.options.getString("project_name");
      const url = interaction.options.getString("url");

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

      // Check project by name
      const project = await Project.findOne({
        name: projectName,
        status: "running",
      });
      if (!project) {
        return interaction.reply({
          content: `❌ No running project found with the name **${projectName}**.`,
          ephemeral: true,
        });
      }

      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);

      // Create tweet record
      const tweet = await Tweet.create({
        projectId: project._id,
        tweetId,
        authorId: interaction.user.id,
        sentAt,
        expiresAt,
      });

      // Create message content similar to the image
      const messageContent =
        `**${project.name}** just posted:\n` +
        `${url}\n\n` +
        `**Engage to collect your points**\n` +
        `**Expires in 24 hours**\n\n` +
        `• **If you interact with this post 15 minutes ago you will receive 3 extra points.**\n` +
        `• **10 points will be given if all tasks are completed!**`;

      // Create buttons matching the image style - all emoji only
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
          .setEmoji("📋")
          .setStyle(ButtonStyle.Primary),
      );

      const message = await interaction.reply({
        content: messageContent,
        components: [row],
        fetchReply: true,
      });

      // Save message ID for future reference
      tweet.embedMessageId = message.id;
      await tweet.save();
    }
  },
};
