import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { Activity } from "../models/Activity.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const activities = await Activity.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({ activities });
  } catch (error) {
    next(error);
  }
});

export default router;

