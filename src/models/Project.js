const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // Optional: ensure unique project names
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null, // Admin can set later
    },
    status: {
      type: String,
      enum: ["running", "ended"],
      default: "running",
    },
    createdBy: {
      type: String, // Admin Discord ID
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
