export function isSubscriptionActive(tier, subscriptionExpiresAt) {
  if (tier !== "pro") return false;
  if (!subscriptionExpiresAt) return true;
  return new Date(subscriptionExpiresAt).getTime() > Date.now();
}
