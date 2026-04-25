import express from "express";
import { bots } from "../data/bots.js";
import { requireAuth } from "../middleware/auth.js";
import { Activity } from "../models/Activity.js";
import { generateConversationTurn } from "../services/gemmaService.js";
import { textToSpeech } from "../services/elevenLabsService.js";
import { refreshUserAverages } from "../utils/scoreAverages.js";

const router = express.Router();

router.get("/bots", requireAuth, (_req, res) => {
  res.json({ bots });
});

router.post("/turn", requireAuth, async (req, res, next) => {
  try {
    const { botId = "mira", history = [], message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const turn = await generateConversationTurn({ botId, history, userMessage: message });
    const speech = await textToSpeech(turn.botReply);

    const activity = await Activity.create({
      user: req.user._id,
      type: "conversation",
      userResponse: message,
      botId,
      botReply: turn.botReply,
      feedback: {
        ...turn.feedback,
        thoughtBubble: turn.thoughtBubble
      },
      scores: turn.scores,
      metadata: { historyLength: history.length }
    });

    await refreshUserAverages(req.user._id);

    res.json({
      activityId: activity._id,
      botReply: turn.botReply,
      thoughtBubble: turn.thoughtBubble,
      feedback: turn.feedback,
      scores: turn.scores,
      speech
    });
  } catch (error) {
    next(error);
  }
});

export default router;

