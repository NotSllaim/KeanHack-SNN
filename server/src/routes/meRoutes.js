import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { isSubscriptionActive } from "../utils/subscription.js";

const router = express.Router();

router.get("/subscription", requireAuth, (req, res) => {
  const tier = req.user.tier || "free";
  const walletAddress = req.user.walletAddress || null;
  const subscriptionExpiresAt = req.user.subscriptionExpiresAt || null;

  res.json({
    tier,
    walletAddress,
    subscriptionExpiresAt,
    isActive: isSubscriptionActive(tier, subscriptionExpiresAt)
  });
});

export default router;
