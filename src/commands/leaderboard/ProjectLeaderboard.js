const {
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const UserProfile = require("../../models/UserProfile");
const Project = require("../../models/Project");

module.exports = {
  name: "project-leaderboard",
  description: "Show top users in a project",
  options: [
    {
      name: "project_name",
      description: "Specify the project name",
      type: ApplicationCommandOptionType.String,
      required: true, // now required
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionsBitField.Flags.SendMessages],

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const projectName = interaction.options.getString("project_name");

    // Fetch the project
    const project = await Project.findOne({ name: projectName });
    if (!project) {
      return interaction.editReply(`❌ Project **${projectName}** not found.`);
    }

    // Fetch top 20 users for the project
    const users = await UserProfile.find({
      "projectPoints.projectId": project._id,
    });

    // Map users to points in this project
    const projectUsers = users
      .map((u) => {
        const entry = u.projectPoints.find(
          (p) => p.projectId.toString() === project._id.toString()
        );
        return {
          discordId: u.discordId,
          username: u.twitterUsername || "Unknown",
          points: entry.points || 0,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);

    if (!projectUsers.length) {
      return interaction.editReply(
        "❌ No users have points in this project yet."
      );
    }

    // Format leaderboard
    const leaderboard = projectUsers
      .map((u, i) => `\`${i + 1}\`. **${u.username}** - \`${u.points} pts\``)
      .join("\n");

    // Format project duration
    const startTimestamp = `<t:${Math.floor(
      project.startDate.getTime() / 1000
    )}:f>`;
    const endTimestamp = project.endDate
      ? `<t:${Math.floor(project.endDate.getTime() / 1000)}:f>`
      : "Ongoing";

    // Embed
    const embed = new EmbedBuilder()
      .setTitle(`🏆 Project Leaderboard: ${project.name}`)
      .setColor("Purple")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(
        `**📅 Project Duration:** ${startTimestamp} - ${endTimestamp}\n` +
          `**ℹ️ Status:** ${project.status}\n\n` +
          `**Top Users:**\n${leaderboard}`
      )
      .setFooter({ text: "Top 20 users" })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
