const express = require("express");
const router = express.Router();
const UserProfile = require("../models/UserProfile");
const Project = require("../models/Project");

// GET /api/projects/leaderboards
router.get("/leaderboards", async (req, res) => {
  try {
    // Fetch all projects, sorted by startDate
    const projects = await Project.find({}).sort({ startDate: 1 }).lean();

    // Prepare leaderboard data for each project
    const leaderboardData = await Promise.all(
      projects.map(async (project) => {
        // Find users who have points for this project
        const users = await UserProfile.find({
          "projectPoints.projectId": project._id,
        }).lean();

        // Map users to points for this project
        const projectLeaderboard = users
          .map((user) => {
            const projectPointObj = user.projectPoints.find(
              (p) => p.projectId.toString() === project._id.toString()
            );
            return {
              username: user.username, // replace with display name if available
              twitter: user.twitterUsername ? `@${user.twitterUsername}` : null,
              points: projectPointObj ? projectPointObj.points : 0,
            };
          })
          // Sort by points descending
          .sort((a, b) => b.points - a.points)
          .slice(0, 100) // top 100
          // Add rank
          .map((u, index) => ({ rank: index + 1, ...u }));

        return {
          id: project._id,
          name: project.name,
          current: project.status === "running",
          leaderboard: projectLeaderboard,
        };
      })
    );

    res.json(leaderboardData);
  } catch (err) {
    console.error("Error fetching project leaderboards:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
