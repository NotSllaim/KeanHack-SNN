import { User } from "../models/User.js";
import { publicUser } from "../utils/tokens.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function applyVerifiedPayment({
  userId,
  signature,
  walletAddress,
  verificationDetails
}) {
  const user = await User.findById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");

  const alreadyUsed = (user.paymentHistory || []).some(
    (entry) => entry.signature === signature
  );
  if (alreadyUsed) throw new Error("DUPLICATE_SIGNATURE");

  const durationDays = Number.parseInt(
    process.env.SUBSCRIPTION_DURATION_DAYS,
    10
  );
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    throw new Error("SUBSCRIPTION_DURATION_DAYS env var is missing or invalid");
  }
  const priceUsdc = Number.parseFloat(process.env.SUBSCRIPTION_PRICE_USDC);
  if (!Number.isFinite(priceUsdc) || priceUsdc <= 0) {
    throw new Error("SUBSCRIPTION_PRICE_USDC env var is missing or invalid");
  }

  const now = new Date();
  const currentExpiry = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt)
    : null;
  const isCurrentlyActive = currentExpiry && currentExpiry.getTime() > now.getTime();
  const baseTime = isCurrentlyActive ? currentExpiry.getTime() : now.getTime();
  const newExpiry = new Date(baseTime + durationDays * MS_PER_DAY);

  user.tier = "pro";
  user.walletAddress = walletAddress;
  user.subscriptionExpiresAt = newExpiry;
  user.paymentHistory.push({
    signature,
    amount: priceUsdc,
    currency: "USDC",
    paidAt: new Date()
  });

  await user.save();

  console.log(
    `[subscription] applied payment user=${user._id} sig=${signature.slice(0, 8)}... expires=${newExpiry.toISOString()} renewal=${isCurrentlyActive}`
  );

  return publicUser(user);
}
