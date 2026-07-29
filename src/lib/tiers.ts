/**
 * Play In 432 entitlement tiers (Phase 1 pricing architecture).
 *
 * Free → Lite ($9.99) → Pro ($19)
 * Web: Stripe Checkout · Native: RevenueCat / StoreKit (Pro products; Lite via Stripe email restore until IAP Lite SKU ships)
 */

export type TierId = "free" | "lite" | "pro";

export const TIER_PRICES = {
  lite: { usd: 9.99, cents: 999, label: "$9.99" },
  pro: { usd: 19, cents: 1900, label: "$19" },
} as const;

/** Lifetime free HQ exports (not monthly). */
export const FREE_HQ_EXPORT_LIMIT = 3;
/** Lite: HQ exports per calendar month (local device counter; best-effort). */
export const LITE_HQ_EXPORTS_PER_MONTH = 10;

/** Free tier may set these concert-reference targets without upgrade. */
export const FREE_TARGET_HZ = [432, 440] as const;

export const TIER_RANK: Record<TierId, number> = {
  free: 0,
  lite: 1,
  pro: 2,
};

export function tierAtLeast(have: TierId, need: TierId): boolean {
  return TIER_RANK[have] >= TIER_RANK[need];
}

export function parseTier(raw: unknown): TierId {
  if (raw === "lite" || raw === "pro" || raw === "free") return raw;
  return "free";
}

export type TierFeatureFlags = {
  allFrequencies: boolean;
  unlimitedHq: boolean;
  batchExport: boolean;
  shareOwnClip: boolean;
  hqLimit: number | null; // null = unlimited
  hqPeriod: "lifetime" | "month" | "unlimited";
};

export function featuresForTier(tier: TierId): TierFeatureFlags {
  switch (tier) {
    case "pro":
      return {
        allFrequencies: true,
        unlimitedHq: true,
        batchExport: true,
        shareOwnClip: true,
        hqLimit: null,
        hqPeriod: "unlimited",
      };
    case "lite":
      return {
        allFrequencies: true,
        unlimitedHq: false,
        batchExport: false,
        shareOwnClip: false,
        hqLimit: LITE_HQ_EXPORTS_PER_MONTH,
        hqPeriod: "month",
      };
    default:
      return {
        allFrequencies: false,
        unlimitedHq: false,
        batchExport: false,
        shareOwnClip: false,
        hqLimit: FREE_HQ_EXPORT_LIMIT,
        hqPeriod: "lifetime",
      };
  }
}

export const LITE_FEATURES = [
  "Everything in Free",
  "All Solfeggio & custom targets",
  `${LITE_HQ_EXPORTS_PER_MONTH} TrueHz Convert HQ exports / month`,
  "WAV or MP3 download",
  "One-time unlock — no subscription",
] as const;

export const PRO_FEATURES = [
  "Everything in Lite",
  "Unlimited TrueHz Convert HQ exports",
  "Batch export queue + ZIP download",
  "Share a clip from your own track (Pro)",
  "One-time unlock — no subscription",
] as const;

export const FREE_FEATURES = [
  "Unlimited live retune · A=440 → A=432",
  "Library, playlists, Learn",
  "Spotify playlist match (metadata only)",
  `${FREE_HQ_EXPORT_LIMIT} TrueHz Convert HQ exports (lifetime)`,
  "TrueHz pure-tone bed",
] as const;
