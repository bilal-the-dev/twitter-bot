const {
  Client,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require("discord.js");
const UserProfile = require("../../models/UserProfile");

const ENTRIES_PER_PAGE = 10; // 10 per page, 10 pages max for top 100

module.exports = {
  name: "leaderboard",
  description: "Show top 100 users by total points",
  options: [],
  permissionsRequired: [],
  botPermissions: [PermissionsBitField.Flags.SendMessages],

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const topUsers = await UserProfile.find({})
      .sort({ totalPoints: -1 })
      .limit(100);

    if (!topUsers.length)
      return interaction.editReply("No users found in leaderboard.");

    const totalPages = Math.ceil(topUsers.length / ENTRIES_PER_PAGE);
    let page = 1;

    const generateEmbed = (page) => {
      const start = (page - 1) * ENTRIES_PER_PAGE;
      const end = start + ENTRIES_PER_PAGE;

      const pageUsers = topUsers.slice(start, end);

      const leaderboard = pageUsers
        .map(
          (u, i) =>
            `\`${start + i + 1}\`. **${u.twitterUsername || "Unknown"}** - \`${
              u.totalPoints
            } pts\``
        )
        .join("\n");

      return new EmbedBuilder()
        .setTitle("🏆 Top 100 Users Leaderboard")
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setDescription(leaderboard)
        .setFooter({
          text: `Page ${page}/${totalPages}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setColor("Gold");
    };

    const generateButtons = (page) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("leaderboard_prev")
          .setLabel("⬅️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 1),
        new ButtonBuilder()
          .setCustomId("leaderboard_next")
          .setLabel("➡️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === totalPages)
      );
    };

    const message = await interaction.editReply({
      embeds: [generateEmbed(page)],
      components: [generateButtons(page)],
    });

    const collector = message.createMessageComponentCollector({
      time: 5 * 60 * 1000, // 5 min
    });

    collector.on("collect", async (btnInteraction) => {
      if (!btnInteraction.isButton()) return;
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({
          content: "You cannot control this leaderboard.",
          ephemeral: true,
        });
      }

      if (btnInteraction.customId === "leaderboard_prev") page--;
      else if (btnInteraction.customId === "leaderboard_next") page++;

      await btnInteraction.update({
        embeds: [generateEmbed(page)],
        components: [generateButtons(page)],
      });
    });
  },
};
