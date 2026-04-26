import express from "express";
import { assignCompanionElement, hasCompleteSurvey } from "../data/companionSurvey.js";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { publicUser, signToken } from "../utils/tokens.js";

const router = express.Router();

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists" });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name, email, passwordHash });
    const token = signToken(user);

    res.status(201).json({ user: publicUser(user), token });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post("/survey", requireAuth, async (req, res, next) => {
  try {
    const { surveyAnswers } = req.body;

    if (!hasCompleteSurvey(surveyAnswers)) {
      return res.status(400).json({ message: "Please answer all companion survey questions" });
    }

    const companionElement = assignCompanionElement(surveyAnswers);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        "profile.companionElement": companionElement,
        "profile.companionSurvey": surveyAnswers
      },
      { new: true }
    ).select("-passwordHash");

    res.json({ user: publicUser(user), companionElement });
  } catch (error) {
    next(error);
  }
});

router.post("/upgrade", requireAuth, async (req, res, next) => {
  try {
    const { transactionSignature, walletAddress } = req.body;

    if (!transactionSignature) {
      return res.status(400).json({ message: "Transaction signature is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        upgraded: true,
        upgradeWalletAddress: walletAddress || req.user.upgradeWalletAddress,
        upgradeTransactionSignature: transactionSignature,
        upgradedAt: new Date()
      },
      { new: true }
    ).select("-passwordHash");

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

export default router;

