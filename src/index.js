require("dotenv").config();
const express = require("express");
const cors = require("cors"); // <-- import cors
const { Client, IntentsBitField } = require("discord.js");
const eventHandler = require("./handlers/eventHandler");
const leaderboardRouter = require("./routes/leaderboardRouter");
const projectLeaderboardRouter = require("./routes/projectLeaderboardsRoute");

// ---------- DISCORD BOT SETUP ----------
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

eventHandler(client);
client.login(process.env.TOKEN);

// ---------- EXPRESS SERVER SETUP ----------
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (or you can limit to your frontend)
app.use(
  cors({
    origin: "http://localhost:5173", // allow only your frontend origin
  })
);

// Middleware for JSON requests
app.use(express.json());

// Routes
app.use("/api/general", leaderboardRouter);
app.use("/api/projects", projectLeaderboardRouter);

// Start the server
app.listen(PORT, () => {
  console.log(`Express server running on http://localhost:${PORT}`);
});
