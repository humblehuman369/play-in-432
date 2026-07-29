/**
 * App Store / Play Billing product catalog for TrueHz Lite + Pro.
 * Must match App Store Connect + RevenueCat product IDs exactly.
 *
 * RevenueCat entitlements:
 *   truehz_lite  — all frequencies + monthly HQ cap
 *   truehz_pro   — full Pro (implies lite features)
 * Offering: `default` (Current)
 */
export const IAP_PRODUCTS = {
  /** One-time Lite unlock */
  lite: {
    id: "com.playin432.app.truehz_lite",
    type: "non_consumable" as const,
    label: "TrueHz Lite",
    priceHint: "$9.99",
    description:
      "All Solfeggio & custom targets + 10 HQ exports per month. One-time.",
    tier: "lite" as const,
  },
  /** One-time lifetime Pro unlock (primary) */
  lifetime: {
    id: "com.playin432.app.truehz_pro",
    type: "non_consumable" as const,
    label: "TrueHz Pro",
    priceHint: "$19.99",
    description:
      "All frequencies + unlimited TrueHz Convert HQ + batch export. One-time.",
    tier: "pro" as const,
  },
  monthly: {
    id: "com.playin432.app.truehz_pro.monthly",
    type: "auto_renewable" as const,
    label: "TrueHz Pro Monthly",
    priceHint: "$4.99/mo",
    description: "All frequencies + unlimited HQ. Cancel anytime.",
    tier: "pro" as const,
  },
  yearly: {
    id: "com.playin432.app.truehz_pro.yearly",
    type: "auto_renewable" as const,
    label: "TrueHz Pro Yearly",
    priceHint: "$29.99/yr",
    description: "All frequencies + unlimited HQ. Best value yearly.",
    tier: "pro" as const,
  },
} as const;

export type ProductKey = keyof typeof IAP_PRODUCTS;

export const ALL_PRODUCT_IDS = Object.values(IAP_PRODUCTS).map((p) => p.id);

/** Product IDs that grant full Pro. */
export const PRO_PRODUCT_IDS = new Set(
  Object.values(IAP_PRODUCTS)
    .filter((p) => p.tier === "pro")
    .map((p) => p.id),
);

/** Product IDs that grant Lite (without full Pro). */
export const LITE_PRODUCT_IDS = new Set(
  Object.values(IAP_PRODUCTS)
    .filter((p) => p.tier === "lite")
    .map((p) => p.id),
);
