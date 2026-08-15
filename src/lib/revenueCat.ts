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
  ALL_PRODUCT_IDS,
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

  try {
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
  } catch (e) {
    console.warn("[RevenueCat] getOfferings failed", e);
    return [];
  }
}

/**
 * Fetch StoreKit products by ID (does not require a non-empty offering).
 * This is the reliable path for App Review when offerings are misconfigured.
 */
export async function getStoreProducts(
  productIds: string[] = ALL_PRODUCT_IDS,
): Promise<
  Array<{
    productId: string;
    title: string;
    priceString: string;
    tier: TierId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    raw: any;
  }>
> {
  if (!configured && !(await initRevenueCat())) return [];

  const { Purchases, PRODUCT_CATEGORY } = await import(
    "@revenuecat/purchases-capacitor"
  );
  try {
    const { products } = await withTimeout(
      Purchases.getProducts({
        productIdentifiers: productIds,
        type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
      }),
      OFFERINGS_TIMEOUT_MS,
      "Store products didn’t load. Check your connection and try again.",
    );
    return (products || []).map((p) => ({
      productId: p.identifier,
      title: p.title || p.identifier,
      priceString: p.priceString || "",
      tier: tierForProductId(p.identifier),
      raw: p,
    }));
  } catch (e) {
    console.warn("[RevenueCat] getProducts failed", e);
    return [];
  }
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
    /product.?not.?available|invalid.?product|could not be found|no products|store product|configuration/i.test(
      raw,
    ) ||
    /PRODUCT_NOT_AVAILABLE|INVALID_PRODUCT|STORE_PROBLEM|PRODUCT_NOT_AVAILABLE_FOR_PURCHASE/i.test(
      code,
    )
  ) {
    return new Error(
      "This product isn’t available from the App Store yet. Please try again in a moment, or tap Restore Purchases if you already bought it.",
    );
  }
  if (/network|offline|internet|timed?\s*out|timeout/i.test(raw)) {
    return new Error(
      "Network error talking to the App Store. Check your connection and try again.",
    );
  }
  if (/not.?allowed|payment|billing|agreement|paid apps/i.test(raw)) {
    return new Error(
      "Purchases aren’t available on this Apple ID right now. Confirm the Paid Apps Agreement is active and try a Sandbox tester account.",
    );
  }
  return new Error(err?.message || fallback);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function activateFromPurchaseResult(
  customerInfo: any,
  fallbackProductId?: string,
): boolean {
  let tier = tierFromCustomerInfo(customerInfo);
  if (tier === "free" && fallbackProductId) {
    tier = tierForProductId(fallbackProductId);
  }
  if (tier === "lite" || tier === "pro") {
    activateTier(
      tier,
      `rc_${customerInfo?.originalAppUserId || "user"}`,
    );
    return true;
  }
  return false;
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
    if (activateFromPurchaseResult(result.customerInfo, pkg.productId)) {
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

/** Purchase by StoreKit product ID (preferred path for App Review reliability). */
export async function purchaseProductId(productId: string): Promise<boolean> {
  if (!configured && !(await initRevenueCat())) {
    throw new Error(
      "In-App Purchases aren’t set up in this build. Rebuild with VITE_REVENUECAT_IOS_API_KEY, then try again.",
    );
  }

  const { Purchases, PRODUCT_CATEGORY, PURCHASES_ERROR_CODE } = await import(
    "@revenuecat/purchases-capacitor"
  );

  // Verify billing is available (iOS always true when StoreKit works)
  try {
    const { canMakePayments } = await Purchases.canMakePayments();
    if (canMakePayments === false) {
      throw new Error(
        "This device cannot make App Store purchases. Sign in with a Sandbox Apple ID under Settings → App Store → Sandbox Account.",
      );
    }
  } catch (e) {
    if (e instanceof Error && /cannot make App Store/i.test(e.message)) throw e;
    /* canMakePayments optional on some plugin versions */
  }

  const { products } = await withTimeout(
    Purchases.getProducts({
      productIdentifiers: [productId],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    }),
    OFFERINGS_TIMEOUT_MS,
    "Store products didn’t load. Check your connection and try again.",
  );

  if (!products?.length) {
    console.warn(
      "[Pro] getProducts returned empty for",
      productId,
      "— check ASC product ID, Paid Apps Agreement, and RevenueCat App Store credentials.",
    );
    throw new Error(
      "App Store could not find this product. Confirm the Paid Apps Agreement is Active and product IDs match App Store Connect exactly.",
    );
  }

  try {
    const result = await Purchases.purchaseStoreProduct({
      product: products[0],
    });
    const purchasedId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any).productIdentifier || productId;
    if (activateFromPurchaseResult(result.customerInfo, purchasedId)) {
      return true;
    }
    // Last resort: grant by the product we just bought (entitlement map lag)
    const tier = tierForProductId(purchasedId);
    if (tier === "lite" || tier === "pro") {
      activateTier(tier, `rc_product_${purchasedId}`);
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
  // Preferred: direct StoreKit product (works even if offerings are empty)
  try {
    return await purchaseProductId(IAP_PRODUCTS.lifetime.id);
  } catch (directErr) {
    console.warn("[Pro] direct product purchase failed, trying offering", directErr);
    const packages = await getPackages();
    const pick =
      packages.find((p) => p.key === "lifetime") ||
      packages.find((p) => p.tier === "pro");
    if (pick) return purchasePackage(pick);
    throw directErr instanceof Error
      ? directErr
      : new Error("TrueHz Pro isn’t available from the App Store right now.");
  }
}

export async function purchaseLite(): Promise<boolean> {
  try {
    return await purchaseProductId(IAP_PRODUCTS.lite.id);
  } catch (directErr) {
    console.warn("[Pro] direct Lite purchase failed, trying offering", directErr);
    const packages = await getPackages();
    const pick =
      packages.find((p) => p.key === "lite") ||
      packages.find((p) => p.tier === "lite");
    if (pick) return purchasePackage(pick);
    throw directErr instanceof Error
      ? directErr
      : new Error("TrueHz Lite isn’t available from the App Store right now.");
  }
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
