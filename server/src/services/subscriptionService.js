import { User } from "../models/User.js";
import { publicUser } from "../utils/tokens.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function applyVerifiedPayment({ userId, signature, walletAddress, verificationDetails }) {
  const durationDays = Number(process.env.SUBSCRIPTION_DURATION_DAYS);
  const priceUsdc = Number(process.env.SUBSCRIPTION_PRICE_USDC);
  if (!Number.isSafeInteger(durationDays) || durationDays <= 0) {
    throw new Error("SUBSCRIPTION_DURATION_DAYS env var is missing or invalid");
  }
  if (!Number.isFinite(priceUsdc) || priceUsdc <= 0) {
    throw new Error("SUBSCRIPTION_PRICE_USDC env var is missing or invalid");
  }
  if (!signature || verificationDetails?.sender !== walletAddress ||
      verificationDetails?.userId !== String(userId) ||
      verificationDetails?.amount !== priceUsdc) {
    throw new Error("INVALID_VERIFICATION_DETAILS");
  }

  // Fail closed until the global unique-signature index exists. Existing
  // cross-account duplicates must be reviewed before enabling this flow.
  await User.init();
  let user;
  try {
    user = await User.findOneAndUpdate(
      { _id: userId, "paymentHistory.signature": { $ne: signature } },
      [{ $set: {
        tier: "pro",
        walletAddress: { $literal: walletAddress },
        subscriptionExpiresAt: { $add: [
          { $cond: [
            { $and: [
              { $eq: ["$tier", "pro"] },
              { $gt: ["$subscriptionExpiresAt", "$$NOW"] }
            ] },
            "$subscriptionExpiresAt",
            "$$NOW"
          ] },
          durationDays * MS_PER_DAY
        ] },
        paymentHistory: { $concatArrays: [
          { $ifNull: ["$paymentHistory", []] },
          [{ signature: { $literal: signature }, amount: priceUsdc, currency: "USDC", paidAt: "$$NOW" }]
        ] }
      } }],
      { new: true }
    );
  } catch (error) {
    if (error.code === 11000) throw new Error("DUPLICATE_SIGNATURE");
    throw error;
  }
  if (!user) throw new Error("DUPLICATE_SIGNATURE");
  return publicUser(user);
}
