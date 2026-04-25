import express from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { speechToText, textToSpeech } from "../services/elevenLabsService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

router.post("/transcribe", requireAuth, upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Audio file is required" });
    }

    const transcript = await speechToText(req.file);
    res.json(transcript);
  } catch (error) {
    next(error);
  }
});

router.post("/speak", requireAuth, async (req, res, next) => {
  try {
    if (!req.body.text) {
      return res.status(400).json({ message: "Text is required" });
    }

    res.json(await textToSpeech(req.body.text));
  } catch (error) {
    next(error);
  }
});

export default router;

