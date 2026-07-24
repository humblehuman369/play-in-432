/**
 * RevenueCat purchases for native iOS/Android (Capacitor).
 * Web continues to use Stripe via pro.startCheckoutStripe().
 *
 * Dashboard setup: store-assets/REVENUECAT.md
 * Entitlement ID: truehz_pro
 * Products: see products.ts
 */
import { Capacitor } from "@capacitor/core";
import {
  IAP_PRODUCTS,
  type ProductKey,
} from "./products";
import { activatePro, isPro } from "./pro";

/** Must match RevenueCat dashboard entitlement identifier */
export const RC_ENTITLEMENT_ID = "truehz_pro";

/** Preferred offering identifier (or use current) */
export const RC_OFFERING_ID = "default";

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

    // Sync existing entitlement → local Pro flag
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
  /** Internal RC package for purchase */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
};

function keyForProductId(productId: string): ProductKey | "unknown" {
  for (const [k, v] of Object.entries(IAP_PRODUCTS)) {
    if (v.id === productId) return k as ProductKey;
  }
  return "unknown";
}

export async function getPackages(): Promise<PackageInfo[]> {
  if (!configured && !(await initRevenueCat())) return [];

  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await Purchases.getOfferings();
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
      raw: pkg,
    };
  });
}

export async function purchasePackage(pkg: PackageInfo): Promise<boolean> {
  if (!configured && !(await initRevenueCat())) {
    throw new Error("RevenueCat is not configured on this build.");
  }

  const { Purchases, PURCHASES_ERROR_CODE } = await import(
    "@revenuecat/purchases-capacitor"
  );

  try {
    const result = await Purchases.purchasePackage({ aPackage: pkg.raw });
    const active =
      result.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    if (active) {
      activatePro(`rc_${result.customerInfo.originalAppUserId || "user"}`);
      return true;
    }
    // Some packages grant entitlement under different timing — re-check
    return await syncProFromCustomerInfo();
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string; userCancelled?: boolean };
    if (
      err?.userCancelled ||
      err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    ) {
      throw new Error("Purchase canceled.");
    }
    throw new Error(err?.message || "Purchase failed.");
  }
}

/** Prefer lifetime, then yearly, then monthly, else first package. */
export async function purchaseDefaultPro(): Promise<boolean> {
  const packages = await getPackages();
  if (!packages.length) {
    throw new Error(
      "No packages available. Configure offerings in the RevenueCat dashboard.",
    );
  }
  const pick =
    packages.find((p) => p.key === "lifetime") ||
    packages.find((p) => p.key === "yearly") ||
    packages.find((p) => p.key === "monthly") ||
    packages[0];
  return purchasePackage(pick);
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured && !(await initRevenueCat())) {
    throw new Error("RevenueCat is not configured on this build.");
  }
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { customerInfo } = await Purchases.restorePurchases();
  const active = customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
  if (active) {
    activatePro(`rc_restore_${customerInfo.originalAppUserId || "user"}`);
    return true;
  }
  return false;
}

export async function syncProFromCustomerInfo(): Promise<boolean> {
  if (!isRevenueCatNative()) return isPro();
  if (!configured && !(await initRevenueCat())) return isPro();

  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.getCustomerInfo();
    const active = customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    if (active) {
      activatePro(`rc_${customerInfo.originalAppUserId || "user"}`);
      return true;
    }
  } catch (e) {
    console.warn("[RevenueCat] getCustomerInfo", e);
  }
  return isPro();
}
