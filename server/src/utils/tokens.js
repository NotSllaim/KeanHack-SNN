import jwt from "jsonwebtoken";
import { isSubscriptionActive } from "./subscription.js";
import { buildProgress } from "./xp.js";

export function signToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export function publicUser(user) {
  const tier = user.tier || "free";
  const subscriptionExpiresAt = user.subscriptionExpiresAt || null;
  const isActive = isSubscriptionActive(tier, subscriptionExpiresAt);

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    scores: user.scores,
    progress: buildProgress(user.progress?.xp),
    tier,
    walletAddress: user.walletAddress || null,
    subscriptionExpiresAt,
    paymentHistory: user.paymentHistory || [],
    isActive
  };
}

