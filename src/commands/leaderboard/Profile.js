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

    // Fetch all projects the user has points in
    const projects = await Project.find({}).sort({ startDate: 1 });

    let currentProjectsText = "";
    let pastProjectsText = "";

    projects.forEach((project, index) => {
      const projectEntry = profile.projectPoints.find(
        (p) => p.projectId.toString() === project._id.toString()
      );
      const points = projectEntry ? projectEntry.points : 0;
      const startTimestamp = `<t:${Math.floor(
        project.startDate.getTime() / 1000
      )}:d>`;
      const endTimestamp = project.endDate
        ? `<t:${Math.floor(project.endDate.getTime() / 1000)}:d>`
        : "Ongoing";

      const line = `\`${index + 1}.\` **${
        project.name
      }** | ${startTimestamp} → ${endTimestamp} | Points: \`${points}\`\n`;

      if (project.status === "running") {
        currentProjectsText += line;
      } else {
        pastProjectsText += line;
      }
    });

    if (!currentProjectsText)
      currentProjectsText = "No active projects at the moment.";
    if (!pastProjectsText) pastProjectsText = "No past projects yet.";

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${targetUser.username}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setColor(0x5865f2)
      .setDescription(
        `**Global Rank:** \`${rankDisplay}\`\n` +
          `**Total Points:** \`${profile.totalPoints}\`\n` +
          `**Twitter:** \`${profile.twitterUsername || "Not Linked"}\``
      )
      .addFields(
        {
          name: "📝 Current Projects",
          value: currentProjectsText,
          inline: false,
        },
        { name: "📚 Past Projects", value: pastProjectsText, inline: false }
      )
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
