import { Activity } from "../models/Activity.js";
import { User } from "../models/User.js";

export async function refreshUserAverages(userId) {
  const activities = await Activity.find({ user: userId }).select("scores");
  if (!activities.length) {
    return;
  }

  const totals = activities.reduce(
    (acc, activity) => {
      acc.confidence += activity.scores?.confidence || 0;
      acc.clarity += activity.scores?.clarity || 0;
      return acc;
    },
    { confidence: 0, clarity: 0 }
  );

  await User.findByIdAndUpdate(userId, {
    "scores.confidenceAverage": Math.round(totals.confidence / activities.length),
    "scores.clarityAverage": Math.round(totals.clarity / activities.length),
    "scores.sessionsCompleted": activities.length
  });
}

