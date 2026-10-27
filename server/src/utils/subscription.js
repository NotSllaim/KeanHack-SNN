export function isSubscriptionActive(tier, subscriptionExpiresAt) {
  if (tier !== "pro") return false;
  if (!subscriptionExpiresAt) return false;
  return new Date(subscriptionExpiresAt).getTime() > Date.now();
}
