const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const ms = require("ms"); // For parsing durations like "1d", "2h"
const Project = require("../../models/Project");

module.exports = {
  name: "project",
  description: "Manage projects (Admin only)",
  options: [
    {
      name: "create",
      description: "Create a new project",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "Project name",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: "start_in",
          description:
            "Start project after a duration (e.g., 1d, 2h, 30m) - default now",
          type: ApplicationCommandOptionType.String,
        },
      ],
    },
    {
      name: "end",
      description: "End the current running project or set an end date",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "end_in",
          description:
            "End project after a duration (e.g., 1d, 2h, 30m) - default now",
          type: ApplicationCommandOptionType.String,
        },
      ],
    },
    {
      name: "status",
      description: "Show current running project",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
  permissionsRequired: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.SendMessages],

  callback: async (client, interaction) => {
    const subcommand = interaction.options.getSubcommand();

    // ========================
    // CREATE PROJECT
    // ========================
    if (subcommand === "create") {
      const name = interaction.options.getString("name");
      const startIn = interaction.options.getString("start_in");
      const startDate = startIn
        ? new Date(Date.now() + ms(startIn))
        : new Date();

      // Check if a project is already running
      const runningProject = await Project.findOne({ status: "running" });
      if (runningProject) {
        return interaction.reply({
          content: `❌ A project is already running: **${runningProject.name}**. You cannot start a new one.`,
          ephemeral: true,
        });
      }

      const project = await Project.create({
        name,
        startDate,
        createdBy: interaction.user.id,
      });

      const embed = new EmbedBuilder()
        .setTitle("🚀 Project Created")
        .setColor("Green")
        .addFields(
          { name: "Name", value: project.name },
          { name: "Start Date", value: project.startDate.toUTCString() },
          { name: "Status", value: project.status }
        )
        .setFooter({ text: `Created by ${interaction.user.tag}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ========================
    // END PROJECT
    // ========================
    if (subcommand === "end") {
      const endIn = interaction.options.getString("end_in");
      const endDate = endIn ? new Date(Date.now() + ms(endIn)) : new Date();

      const runningProject = await Project.findOne({ status: "running" });
      if (!runningProject) {
        return interaction.reply({
          content: "❌ No project is currently running.",
          ephemeral: true,
        });
      }

      runningProject.endDate = endDate;
      runningProject.status = "ended";
      await runningProject.save();

      const embed = new EmbedBuilder()
        .setTitle("✅ Project Ended")
        .setColor("Red")
        .addFields(
          { name: "Name", value: runningProject.name },
          { name: "Start Date", value: runningProject.startDate.toUTCString() },
          { name: "End Date", value: runningProject.endDate.toUTCString() },
          { name: "Status", value: runningProject.status }
        );

      return interaction.reply({ embeds: [embed] });
    }

    // ========================
    // PROJECT STATUS
    // ========================
    if (subcommand === "status") {
      const runningProject = await Project.findOne({ status: "running" });
      if (!runningProject) {
        return interaction.reply({
          content: "❌ No project is currently running.",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📊 Current Running Project")
        .setColor("Blue")
        .addFields(
          { name: "Name", value: runningProject.name },
          { name: "Start Date", value: runningProject.startDate.toUTCString() },
          { name: "Status", value: runningProject.status }
        );

      return interaction.reply({ embeds: [embed] });
    }
  },
};
