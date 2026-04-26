import jwt from "jsonwebtoken";
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
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    scores: user.scores,
    progress: buildProgress(user.progress?.xp)
  };
}

