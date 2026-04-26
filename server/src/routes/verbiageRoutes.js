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
  "Describe a recent challenge and what you learned from it."
];

router.get("/prompt", requireAuth, (_req, res) => {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  res.json({ prompt });
});

router.post("/analyze", requireAuth, async (req, res, next) => {
  try {
    const { prompt, response } = req.body;

    if (!prompt || !response) {
      return res.status(400).json({ message: "Prompt and response are required" });
    }

    const analysis = await analyzeVerbiage({ promptText: prompt, responseText: response });
    const activity = await Activity.create({
      user: req.user._id,
      type: "verbiage",
      prompt,
      userResponse: response,
      feedback: analysis.feedback,
      scores: analysis.scores
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

