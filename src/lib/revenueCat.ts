/**
 * RevenueCat purchases for native iOS/Android (Capacitor).
 * Web continues to use Stripe via pro.startCheckoutStripe().
 *
 * Dashboard setup: store-assets/REVENUECAT.md
 * Entitlements: truehz_pro (full), truehz_lite (frequencies + monthly HQ)
 * Products: see products.ts
 */
import { Capacitor } from "@capacitor/core";
import {
  IAP_PRODUCTS,
  LITE_PRODUCT_IDS,
  PRO_PRODUCT_IDS,
  type ProductKey,
} from "./products";
import { activateTier, getTier } from "./pro";
import type { TierId } from "./tiers";

/** Full Pro entitlement (must match RevenueCat dashboard) */
export const RC_ENTITLEMENT_PRO = "truehz_pro";
/** Lite entitlement */
export const RC_ENTITLEMENT_LITE = "truehz_lite";
/** @deprecated use RC_ENTITLEMENT_PRO */
export const RC_ENTITLEMENT_ID = RC_ENTITLEMENT_PRO;

export const RC_OFFERING_ID = "default";

/** Product-loading must never hang the purchase UI (App Store 2.1b). */
const OFFERINGS_TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function iosKey(): string {
  return (
    (import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined)?.trim() ||
    ""
  );
}

function androidKey(): string {
  return (
    (import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined)?.trim() ||
    ""
  );
}

export function isRevenueCatNative(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    const p = Capacitor.getPlatform();
    return p === "ios" || p === "android";
  } catch {
    return false;
  }
}

let configured = false;

export async function initRevenueCat(): Promise<boolean> {
  if (!isRevenueCatNative()) return false;
  if (configured) return true;

  const platform = Capacitor.getPlatform();
  const apiKey = platform === "ios" ? iosKey() : androidKey();
  if (!apiKey) {
    console.warn(
      "[RevenueCat] Missing VITE_REVENUECAT_IOS_API_KEY or VITE_REVENUECAT_ANDROID_API_KEY",
    );
    return false;
  }

  try {
    const { Purchases, LOG_LEVEL } = await import(
      "@revenuecat/purchases-capacitor"
    );
    if (import.meta.env.DEV) {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }
    await Purchases.configure({ apiKey });
    configured = true;
    await syncProFromCustomerInfo();
    return true;
  } catch (e) {
    console.warn("[RevenueCat] configure failed", e);
    return false;
  }
}

export type PackageInfo = {
  key: ProductKey | "unknown";
  identifier: string;
  productId: string;
  title: string;
  description: string;
  priceString: string;
  tier: TierId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
};

function keyForProductId(productId: string): ProductKey | "unknown" {
  for (const [k, v] of Object.entries(IAP_PRODUCTS)) {
    if (v.id === productId) return k as ProductKey;
  }
  return "unknown";
}

function tierForProductId(productId: string): TierId {
  if (PRO_PRODUCT_IDS.has(productId as never)) return "pro";
  if (LITE_PRODUCT_IDS.has(productId as never)) return "lite";
  return "free";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tierFromCustomerInfo(customerInfo: any): TierId {
  const active = customerInfo?.entitlements?.active || {};
  if (active[RC_ENTITLEMENT_PRO]) return "pro";
  if (active[RC_ENTITLEMENT_LITE]) return "lite";
  // Fallback: scan active product identifiers
  const productIds: string[] =
    customerInfo?.allPurchasedProductIdentifiers ||
    customerInfo?.activeSubscriptions ||
    [];
  for (const id of productIds) {
    if (PRO_PRODUCT_IDS.has(id as never)) return "pro";
  }
  for (const id of productIds) {
    if (LITE_PRODUCT_IDS.has(id as never)) return "lite";
  }
  return "free";
}

export async function getPackages(): Promise<PackageInfo[]> {
  if (!configured && !(await initRevenueCat())) return [];

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await withTimeout(
    Purchases.getOfferings(),
    OFFERINGS_TIMEOUT_MS,
    "Store products didn’t load. Check your connection and try again.",
  );
  const current =
    offerings.current ||
    offerings.all?.[RC_OFFERING_ID] ||
    Object.values(offerings.all || {})[0];

  if (!current?.availablePackages?.length) return [];

  return current.availablePackages.map((pkg) => {
    const product = pkg.product;
    const productId = product.identifier;
    return {
      key: keyForProductId(productId),
      identifier: pkg.identifier,
      productId,
      title: product.title || productId,
      description: product.description || "",
      priceString: product.priceString || "",
      tier: tierForProductId(productId),
      raw: pkg,
    };
  });
}

function friendlyPurchaseError(e: unknown, fallback: string): Error {
  const err = e as {
    code?: string | number;
    message?: string;
    userCancelled?: boolean;
    underlyingErrorMessage?: string;
  };
  const raw = `${err?.message || ""} ${err?.underlyingErrorMessage || ""}`.toLowerCase();
  const code = String(err?.code ?? "");

  if (err?.userCancelled || /cancel/i.test(code) || /cancel/i.test(raw)) {
    return new Error("Purchase canceled.");
  }
  if (
    /product.?not.?available|invalid.?product|could not be found|no products|store product/i.test(
      raw,
    ) ||
    /PRODUCT_NOT_AVAILABLE|INVALID_PRODUCT|STORE_PROBLEM/i.test(code)
  ) {
    return new Error(
      "This product isn’t available from the App Store yet. Please try again in a moment, or tap Restore Purchases if you already bought it.",
    );
  }
  if (/network|offline|internet|timed?\s*out|timeout/i.test(raw)) {
    return new Error("Network error talking to the App Store. Check your connection and try again.");
  }
  if (/not.?allowed|payment|billing|agreement|paid apps/i.test(raw)) {
    return new Error(
      "Purchases aren’t available on this Apple ID right now. Confirm the Paid Apps Agreement is active and try a Sandbox tester account.",
    );
  }
  return new Error(err?.message || fallback);
}

export async function purchasePackage(pkg: PackageInfo): Promise<boolean> {
  if (!configured && !(await initRevenueCat())) {
    throw new Error(
      "In-App Purchases aren’t set up in this build. Rebuild with VITE_REVENUECAT_IOS_API_KEY, then try again.",
    );
  }

  const { Purchases, PURCHASES_ERROR_CODE } = await import(
    "@revenuecat/purchases-capacitor"
  );

  try {
    const result = await Purchases.purchasePackage({ aPackage: pkg.raw });
    const tier = tierFromCustomerInfo(result.customerInfo);
    if (tier === "lite" || tier === "pro") {
      activateTier(
        tier,
        `rc_${result.customerInfo.originalAppUserId || "user"}`,
      );
      return true;
    }
    return await syncProFromCustomerInfo();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; userCancelled?: boolean };
    if (
      err?.userCancelled ||
      err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      throw new Error("Purchase canceled.");
    }
    throw friendlyPurchaseError(e, "Purchase failed. Please try again.");
  }
}

/** One-time lifetime Pro (no subscriptions). Never falls back to Lite. */
export async function purchaseDefaultPro(): Promise<boolean> {
  const packages = await getPackages();
  if (!packages.length) {
    console.warn(
      "[Pro] No RevenueCat packages in the current offering — check the dashboard offering + App Store Connect product status.",
    );
    throw new Error(
      "App Store products didn’t load. Confirm TrueHz Lite/Pro are created in App Store Connect, attached to this version, and that the Paid Apps Agreement is Active — then try again.",
    );
  }
  const pick =
    packages.find((p) => p.key === "lifetime") ||
    packages.find((p) => p.tier === "pro");
  if (!pick) {
    console.warn(
      "[Pro] No Pro package in the current offering — add com.playin432.app.truehz_pro to RevenueCat.",
    );
    throw new Error(
      "TrueHz Pro isn’t available in the store catalog yet. Confirm product com.playin432.app.truehz_pro is in the default RevenueCat offering.",
    );
  }
  return purchasePackage(pick);
}

export async function purchaseLite(): Promise<boolean> {
  const packages = await getPackages();
  if (!packages.length) {
    console.warn(
      "[Pro] No RevenueCat packages when purchasing Lite — check App Store Connect + RevenueCat.",
    );
    throw new Error(
      "App Store products didn’t load. Confirm TrueHz Lite/Pro are created in App Store Connect, attached to this version, and that the Paid Apps Agreement is Active — then try again.",
    );
  }
  const pick =
    packages.find((p) => p.key === "lite") ||
    packages.find((p) => p.tier === "lite");
  if (!pick) {
    throw new Error(
      "TrueHz Lite isn’t available in the store catalog yet. Confirm product com.playin432.app.truehz_lite is in the default RevenueCat offering.",
    );
  }
  return purchasePackage(pick);
}

/** Purchase a specific tier (lite | pro). */
export async function purchaseTier(tier: "lite" | "pro"): Promise<boolean> {
  return tier === "lite" ? purchaseLite() : purchaseDefaultPro();
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured && !(await initRevenueCat())) {
    throw new Error("RevenueCat is not configured on this build.");
  }
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { customerInfo } = await Purchases.restorePurchases();
  const tier = tierFromCustomerInfo(customerInfo);
  if (tier === "lite" || tier === "pro") {
    activateTier(tier, `rc_restore_${customerInfo.originalAppUserId || "user"}`);
    return true;
  }
  return false;
}

export async function syncProFromCustomerInfo(): Promise<boolean> {
  if (!isRevenueCatNative()) return getTier() !== "free";
  if (!configured && !(await initRevenueCat())) return getTier() !== "free";

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.getCustomerInfo();
    const tier = tierFromCustomerInfo(customerInfo);
    if (tier === "lite" || tier === "pro") {
      activateTier(tier, `rc_${customerInfo.originalAppUserId || "user"}`);
      return true;
    }
  } catch (e) {
    console.warn("[RevenueCat] getCustomerInfo", e);
  }
  return getTier() !== "free";
}
