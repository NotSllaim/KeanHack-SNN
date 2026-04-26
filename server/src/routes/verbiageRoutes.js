import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { Activity } from "../models/Activity.js";
import { analyzeVerbiage } from "../services/gemmaService.js";
import { refreshUserAverages } from "../utils/scoreAverages.js";
import { publicUser } from "../utils/tokens.js";
import { awardActivityXp } from "../utils/xp.js";

const router = express.Router();

const prompts = [
  "Tell a new teammate what kind of collaboration helps you do your best work.",
  "Explain why you would be a strong fit for a leadership role.",
  "Describe a recent challenge and what you learned from it.",
  "Tell someone about a mistake you made without sounding defensive or overly harsh on yourself.",
  "Explain a personal goal you care about and why it matters to you.",
  "Describe a time you changed your mind about something important.",
  "Tell a friend that you need space without making it sound like you are rejecting them.",
  "Explain why a project or hobby matters to you in a way that would make someone curious.",
  "Respond to someone who disagrees with you while still sounding calm and open-minded.",
  "Describe what you bring to a group besides technical skill or hard work.",
  "Tell someone about a moment when you felt proud, but do it without bragging.",
  "Explain a complicated idea from your field to someone who knows nothing about it.",
  "Tell a story about a small moment that says something bigger about who you are.",
  "Ask someone for help in a way that sounds confident instead of helpless.",
  "Explain what you are looking for in a friendship, team, or community.",
  "Give feedback to someone kindly while still being direct about what needs to change.",
  "Describe how you handle pressure when people are depending on you.",
  "Tell someone why they should care about an issue you think is overlooked."
];

router.get("/prompt", requireAuth, (_req, res) => {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  res.json({ prompt });
});

router.post("/analyze", requireAuth, async (req, res, next) => {
  try {
    const { prompt, response, audioMetrics } = req.body;

    if (!prompt || !response) {
      return res.status(400).json({ message: "Prompt and response are required" });
    }

    const analysis = await analyzeVerbiage({ promptText: prompt, responseText: response, audioMetrics });
    const activity = await Activity.create({
      user: req.user._id,
      type: "verbiage",
      prompt,
      userResponse: response,
      feedback: analysis.feedback,
      scores: analysis.scores,
      metadata: { audioMetrics }
    });

    await refreshUserAverages(req.user._id);
    const xp = await awardActivityXp(req.user._id, "verbiage");
    res.json({
      activityId: activity._id,
      ...analysis,
      xp: {
        awarded: xp.xpAwarded,
        leveledUp: xp.leveledUp,
        progress: xp.progress
      },
      user: publicUser(xp.user)
    });
  } catch (error) {
    next(error);
  }
});

export default router;

