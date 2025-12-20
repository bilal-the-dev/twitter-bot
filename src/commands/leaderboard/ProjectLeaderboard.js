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
      description: "Optional: specify a project, defaults to current running",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  permissionsRequired: [],
  botPermissions: [PermissionsBitField.Flags.SendMessages],

  callback: async (client, interaction) => {
    await interaction.deferReply();

    let projectName = interaction.options.getString("project_name");

    let project;
    if (projectName) {
      project = await Project.findOne({ name: projectName });
      if (!project) {
        return interaction.editReply(
          `❌ Project **${projectName}** not found.`
        );
      }
    } else {
      project = await Project.findOne({ status: "running" });
      if (!project) {
        return interaction.editReply("❌ No running project found.");
      }
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
          username: u.twitterUsername,
          points: entry.points,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);

    if (!projectUsers.length)
      return interaction.editReply(
        "❌ No users have points in this project yet."
      );

    const leaderboard = projectUsers
      .map(
        (u, i) =>
          `\`${i + 1}\`. **${u.username || "Unknown"}** - \`${u.points} pts\``
      )
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Project Leaderboard: ${project.name}`)
      .setDescription(leaderboard)
      .setColor("Purple")
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: "📅 Project Duration",
          value: `${project.startDate.toDateString()} - ${
            project.endDate ? project.endDate.toDateString() : "Ongoing"
          }`,
          inline: true,
        },
        {
          name: "ℹ️ Status",
          value: `${project.status}`,
          inline: true,
        }
      )
      .setFooter({ text: `Top 20 users` });

    return interaction.editReply({ embeds: [embed] });
  },
};
