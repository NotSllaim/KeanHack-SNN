import { User } from "../models/User.js";

export const XP_BY_ACTIVITY = {
  conversation: 15,
  reading: 25,
  verbiage: 25
};

export const LEVEL_THRESHOLDS = [0, 100, 250];
export const MAX_LEVEL = 3;

export function buildProgress(totalXp = 0) {
  const xp = Math.max(0, Number(totalXp) || 0);
  const level = xp >= LEVEL_THRESHOLDS[2] ? 3 : xp >= LEVEL_THRESHOLDS[1] ? 2 : 1;
  const currentLevelXp = LEVEL_THRESHOLDS[level - 1];
  const nextLevelXp = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[MAX_LEVEL - 1];
  const xpIntoLevel = Math.max(0, xp - currentLevelXp);
  const xpForLevel = Math.max(1, nextLevelXp - currentLevelXp);
  const progressPercent = level === MAX_LEVEL
    ? 100
    : Math.round(Math.min(100, (xpIntoLevel / xpForLevel) * 100));

  return {
    xp,
    level,
    maxLevel: MAX_LEVEL,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForLevel,
    progressPercent
  };
}

export async function awardActivityXp(userId, activityType) {
  const xpAwarded = XP_BY_ACTIVITY[activityType] || 10;
  const user = await User.findById(userId).select("progress");
  const previous = buildProgress(user?.progress?.xp);
  const nextXp = previous.xp + xpAwarded;
  const next = buildProgress(nextXp);

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { "progress.xp": xpAwarded },
      $set: { "progress.level": next.level }
    },
    { new: true }
  ).select("-passwordHash");

  return {
    user: updatedUser,
    xpAwarded,
    leveledUp: next.level > previous.level,
    progress: next
  };
}
