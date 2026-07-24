/**
 * App Store / Play Billing product catalog for TrueHz Pro.
 * Must match App Store Connect + RevenueCat product IDs exactly.
 *
 * RevenueCat entitlement: `truehz_pro`
 * RevenueCat offering: `default` (Current)
 */
export const IAP_PRODUCTS = {
  /** One-time lifetime unlock (primary) */
  lifetime: {
    id: "com.playin432.app.truehz_pro",
    type: "non_consumable" as const,
    label: "TrueHz Pro",
    priceHint: "$19.99",
    description: "All frequencies + unlimited HQ WAV export. One-time.",
  },
  monthly: {
    id: "com.playin432.app.truehz_pro.monthly",
    type: "auto_renewable" as const,
    label: "TrueHz Pro Monthly",
    priceHint: "$4.99/mo",
    description: "All frequencies + unlimited HQ. Cancel anytime.",
  },
  yearly: {
    id: "com.playin432.app.truehz_pro.yearly",
    type: "auto_renewable" as const,
    label: "TrueHz Pro Yearly",
    priceHint: "$29.99/yr",
    description: "All frequencies + unlimited HQ. Best value yearly.",
  },
} as const;

export type ProductKey = keyof typeof IAP_PRODUCTS;

export const ALL_PRODUCT_IDS = Object.values(IAP_PRODUCTS).map((p) => p.id);
