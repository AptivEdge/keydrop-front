export type PublicBillingPrices = {
  pro: { monthly: number; yearly: number };
  team: { monthly: number; yearly: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePublicBillingPrices(value: unknown): PublicBillingPrices | null {
  if (!Array.isArray(value)) return null;

  const prices: Partial<PublicBillingPrices> = {};
  for (const item of value) {
    if (
      !isRecord(item)
      || (item.tier !== "pro" && item.tier !== "team")
      || (item.interval !== "monthly" && item.interval !== "yearly")
      || typeof item.amount !== "number"
      || !Number.isSafeInteger(item.amount)
      || item.amount <= 0
      || item.currency !== "INR"
    ) {
      return null;
    }

    const tierPrices = prices[item.tier] ?? { monthly: Number.NaN, yearly: Number.NaN };
    if (Number.isFinite(tierPrices[item.interval])) return null;
    tierPrices[item.interval] = item.amount / 100;
    prices[item.tier] = tierPrices;
  }

  if (
    !prices.pro
    || !prices.team
    || !Number.isFinite(prices.pro.monthly)
    || !Number.isFinite(prices.pro.yearly)
    || !Number.isFinite(prices.team.monthly)
    || !Number.isFinite(prices.team.yearly)
  ) {
    return null;
  }

  return {
    pro: prices.pro,
    team: prices.team,
  };
}
