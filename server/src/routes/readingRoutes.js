import express from "express";
import { passages, randomPassage } from "../data/passages.js";
import { requireAuth } from "../middleware/auth.js";
import { Activity } from "../models/Activity.js";
import { analyzeReading } from "../services/gemmaService.js";
import { refreshUserAverages } from "../utils/scoreAverages.js";

const router = express.Router();

router.get("/passage", requireAuth, (req, res) => {
  const requested = passages.find((passage) => passage.id === req.query.id);
  res.json({ passage: requested || randomPassage() });
});

router.post("/analyze", requireAuth, async (req, res, next) => {
  try {
    const { passage, transcript } = req.body;

    if (!passage || !transcript) {
      return res.status(400).json({ message: "Passage and transcript are required" });
    }

    const analysis = await analyzeReading({ passage, transcript });
    const activity = await Activity.create({
      user: req.user._id,
      type: "reading",
      prompt: passage,
      userResponse: transcript,
      feedback: analysis.feedback,
      scores: analysis.scores
    });

    await refreshUserAverages(req.user._id);
    res.json({ activityId: activity._id, ...analysis });
  } catch (error) {
    next(error);
  }
});

export default router;

