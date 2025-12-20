const express = require("express");
const UserProfile = require("../models/UserProfile");
const router = express.Router();

// GET /api/general/leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    // Fetch top 100 users sorted by totalPoints descending
    const users = await UserProfile.find({})
      .sort({ totalPoints: -1 })
      .limit(100)
      .lean(); // lean() returns plain JS objects

    console.log(users); // Format response
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username, // you can replace with another username field if exists
      twitter: user.twitterUsername ? `@${user.twitterUsername}` : null,
      points: user.totalPoints || 0,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching leaderboard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
