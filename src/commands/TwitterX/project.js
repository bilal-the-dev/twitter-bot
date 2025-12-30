const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const ms = require("ms");
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
          description: "Project name (must be unique)",
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
      description: "End a project by name",
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: "name",
          description: "Project name to end (required)",
          type: ApplicationCommandOptionType.String,
          required: true,
        },
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
      description: "Show running projects",
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],

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

      // Check if project name is unique
      const existing = await Project.findOne({ name });
      if (existing) {
        return interaction.reply({
          content: `❌ A project with the name **${name}** already exists. Please choose a different name.`,
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
        .setColor("#00FF7F")
        .setDescription(
          `A new project has been successfully created!\n\n` +
            `📌 **Name:** ${project.name}\n` +
            `🗓 **Start Date:** <t:${Math.floor(
              project.startDate.getTime() / 1000
            )}:f>\n` +
            `⚡ **Status:** ${project.status}\n` +
            `👤 **Created By:** ${interaction.user.tag}`
        )
        .setTimestamp()
        .setFooter({ text: "Project Management System" });

      return interaction.reply({ embeds: [embed] });
    }

    // ========================
    // END PROJECT
    // ========================
    if (subcommand === "end") {
      const name = interaction.options.getString("name");
      const endIn = interaction.options.getString("end_in");
      const endDate = endIn ? new Date(Date.now() + ms(endIn)) : new Date();

      // Validate endDate
      if (isNaN(endDate.getTime())) {
        return interaction.reply({
          content: "❌ Invalid end date provided.",
          ephemeral: true,
        });
      }

      const project = await Project.findOne({ name, status: "running" });

      if (!project) {
        return interaction.reply({
          content: `❌ No running project found with the name **${name}**.`,
          ephemeral: true,
        });
      }

      // Validation: end date must not be before start date
      if (endDate < project.startDate) {
        return interaction.reply({
          content:
            `❌ The end date cannot be earlier than the start date of the project.\n` +
            `🗓 Start Date: <t:${Math.floor(
              project.startDate.getTime() / 1000
            )}:f>\n` +
            `🛑 Provided End Date: <t:${Math.floor(
              endDate.getTime() / 1000
            )}:f>`,
          ephemeral: true,
        });
      }

      // Optional: sanity check (end date not too far in the future)
      const maxFuture = new Date();
      maxFuture.setFullYear(maxFuture.getFullYear() + 5);
      if (endDate > maxFuture) {
        return interaction.reply({
          content: `❌ The end date cannot be more than 5 years in the future.`,
          ephemeral: true,
        });
      }

      // Logs channel ID
      const LOGS_CHANNEL_ID = process.env.LOGS_CHANNEL_ID; // replace this with your actual ID
      const logsChannel = interaction.guild.channels.cache.get(LOGS_CHANNEL_ID);

      if (endDate <= new Date()) {
        // Immediate end
        project.endDate = endDate;
        project.status = "ended";
        await project.save();

        const embed = new EmbedBuilder()
          .setTitle("✅ Project Ended")
          .setColor("#FF4500")
          .setDescription(
            `Project **${project.name}** has been ended successfully!\n\n` +
              `📌 **Name:** ${project.name}\n` +
              `🗓 **Start Date:** <t:${Math.floor(
                project.startDate.getTime() / 1000
              )}:f>\n` +
              `🛑 **End Date:** <t:${Math.floor(
                project.endDate.getTime() / 1000
              )}:f>\n` +
              `⚡ **Status:** ${project.status}`
          )
          .setTimestamp()
          .setFooter({ text: "Project Management System" });

        // Send to logs channel if exists
        if (logsChannel) {
          logsChannel.send({ embeds: [embed] });
        }

        return interaction.reply({ embeds: [embed] });
      } else {
        // Future end date
        project.endDate = endDate;
        await project.save();
        const embed = new EmbedBuilder()
          .setTitle("⏳ Project Scheduled to End")
          .setColor("#FFA500")
          .setDescription(
            `Project **${project.name}** is scheduled to end at <t:${Math.floor(
              endDate.getTime() / 1000
            )}:f>.\n\n` +
              `📌 **Name:** ${project.name}\n` +
              `🗓 **Start Date:** <t:${Math.floor(
                project.startDate.getTime() / 1000
              )}:f>\n` +
              `⚡ **Status:** ${project.status}\n\n` +
              `A notification will be sent to the logs channel when it ends.`
          )
          .setTimestamp()
          .setFooter({ text: "Project Management System" });

        // Optional: Schedule automatic end notification (needs a scheduler)
        // Example: setTimeout or node-cron can be used to mark project ended at endDate

        return interaction.reply({ embeds: [embed] });
      }
    }

    // ========================
    // PROJECT STATUS
    // ========================
    if (subcommand === "status") {
      const runningProjects = await Project.find({ status: "running" }).sort({
        createdAt: -1,
      });

      if (!runningProjects.length) {
        return interaction.reply({
          content: "❌ No running projects currently.",
          ephemeral: true,
        });
      }

      let description = `Here are all currently running projects:\n\n`;

      runningProjects.forEach((project, index) => {
        const endDateText = project.endDate
          ? `<t:${Math.floor(project.endDate.getTime() / 1000)}:f>`
          : "Not added yet";

        description +=
          `#${index + 1} **${project.name}**\n` +
          `🗓 Start:  (<t:${Math.floor(
            project.startDate.getTime() / 1000
          )}:f>)\n` +
          `🛑 End: \`${
            endDateText === "Not added yet"
              ? "Not added yet"
              : Math.floor(project.endDate.getTime() / 1000)
          }\` (${endDateText})\n` +
          `👤 Created By: <@${project.createdBy}>\n\n`;
      });

      const embed = new EmbedBuilder()
        .setTitle("📊 Running Projects")
        .setColor("#1E90FF")
        .setDescription(description)
        .setTimestamp()
        .setFooter({ text: "Project Management System" });

      return interaction.reply({ embeds: [embed] });
    }
  },
};
