const mongoose = require("mongoose");
const assignTweetPointsCron = require("../../utils/assignTweetPoints");
const cron = require("node-cron");
const Project = require("../../models/Project");
const { EmbedBuilder } = require("discord.js");
module.exports = async (client) => {
  console.log(`${client.user.tag} is online.`);
  try {
    await mongoose.connect(process.env.MONGO_URI);

    cron.schedule("*/3 * * * *", async () => {
      try {
        await assignTweetPointsCron(client);
      } catch (err) {
        console.error("[CRON ERROR]", err);
      }
    });

    cron.schedule("* * * * *", async () => {
      try {
        const now = new Date();
        // Find all running projects whose endDate has passed
        const projectsToEnd = await Project.find({
          status: "running",
          endDate: { $lte: now },
        });

        if (!projectsToEnd.length) return; // Nothing to do

        const logsChannel = client.channels.cache.get(
          process.env.LOGS_CHANNEL_ID
        );

        for (const project of projectsToEnd) {
          project.status = "ended";
          await project.save();

          const embed = new EmbedBuilder()
            .setTitle("✅ Project Ended")
            .setColor("#FF4500")
            .setDescription(
              `Project **${project.name}** has ended automatically as the end date has been reached.\n\n` +
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

          if (logsChannel) {
            logsChannel.send({ embeds: [embed] });
          }
        }
      } catch (err) {
        console.error("Error ending projects in cron job:", err);
      }
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  }
};
