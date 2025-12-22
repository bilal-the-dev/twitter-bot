const mongoose = require("mongoose");
const assignTweetPointsCron = require("../../utils/assignTweetPoints");
const cron = require("node-cron");
module.exports = async (client) => {
  console.log(`${client.user.tag} is online.`);
  try {
    await mongoose.connect(process.env.MONGO_URI);

    cron.schedule("*/15 * * * *", async () => {
      try {
        await assignTweetPointsCron(client);
      } catch (err) {
        console.error("[CRON ERROR]", err);
      }
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  }
};
