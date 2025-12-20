const {
  Client,
  ApplicationCommandOptionType,
  EmbedBuilder,
} = require("discord.js");
const UserProfile = require("../../models/UserProfile");
const Project = require("../../models/Project");

module.exports = {
  name: "profile",
  description: "Show your profile and points",
  options: [
    {
      name: "user",
      description: "Optional: view another user's profile",
      type: ApplicationCommandOptionType.User,
    },
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser("user") || interaction.user;

    // Fetch user profile
    const profile = await UserProfile.findOne({ discordId: targetUser.id });
    if (!profile) {
      return interaction.editReply(
        `❌ No profile found for ${targetUser.tag}.`
      );
    }

    // Get global rank (top 100)
    const topUsers = await UserProfile.find({})
      .sort({ totalPoints: -1 })
      .limit(100);

    let rank = topUsers.findIndex((u) => u.discordId === targetUser.id) + 1;
    const rankDisplay = rank > 0 ? `#${rank}` : "Not in Top 100";

    // Get current running project
    const currentProject = await Project.findOne({ status: "running" });

    let projectDescription = "No active project at the moment";
    let projectPoints = 0;

    if (currentProject) {
      const projectEntry = profile.projectPoints.find(
        (p) => p.projectId.toString() === currentProject._id.toString()
      );
      projectPoints = projectEntry ? projectEntry.points : 0;

      const startDate = currentProject.startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const endDate = currentProject.endDate
        ? currentProject.endDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Ongoing";

      projectDescription =
        `**${currentProject.name}**\n` +
        `${startDate} → ${endDate}\n` +
        `Your Points: \`${projectPoints}\``;
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${targetUser.username}'s Profile`)
      .setDescription(
        `**Global Rank:** \`${rankDisplay}\`\n` +
          `**Total Points:** \`${profile.totalPoints}\`\n` +
          `**Twitter:** \`${profile.twitterUsername || "Not Linked"}\``
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(0x5865f2)
      .addFields({
        name: "📝 Current Project",
        value: projectDescription,
        inline: false,
      })
      .setFooter({
        text: `Last updated: ${profile.lastUpdatedAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })} • Use /leaderboard to see rankings`,
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
