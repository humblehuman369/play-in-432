/**
 * TrueHz entitlement (client-side + Stripe Checkout + native IAP).
 *
 * Free: live A=432/440, library, limited HQ exports (lifetime).
 * Lite ($9.99): all frequency targets, 10 HQ exports / month.
 * Pro ($19 web / $19.99 App Store): unlimited HQ, batch export, share-own-clip.
 *
 * Web → Stripe Checkout · Native → RevenueCat / StoreKit (gifts always Stripe).
 * Note: localStorage can be spoofed. v1 trusts verified Stripe sessions + RC customerInfo.
 */
import {
  FREE_HQ_EXPORT_LIMIT,
  FREE_TARGET_HZ,
  LITE_HQ_EXPORTS_PER_MONTH,
  TIER_PRICES,
  featuresForTier,
  parseTier,
  tierAtLeast,
  type TierId,
} from "./tiers";

export {
  FREE_HQ_EXPORT_LIMIT,
  FREE_TARGET_HZ,
  LITE_HQ_EXPORTS_PER_MONTH,
  TIER_PRICES,
  FREE_FEATURES,
  LITE_FEATURES,
  PRO_FEATURES,
  type TierId,
} from "./tiers";

export const PRO_PRICE_USD = TIER_PRICES.pro.usd;
export const PRO_PRICE_LABEL = TIER_PRICES.pro.label;
export const PRO_PRICE_CENTS = TIER_PRICES.pro.cents;
export const LITE_PRICE_USD = TIER_PRICES.lite.usd;
export const LITE_PRICE_LABEL = TIER_PRICES.lite.label;
export const LITE_PRICE_CENTS = TIER_PRICES.lite.cents;

const LS_TIER = "playin432_tier";
const LS_PRO = "playin432_pro"; // legacy "1" flag
const LS_PRO_SESSION = "playin432_pro_session";
const LS_HQ_USED = "playin432_hq_exports_used";
const LS_LITE_HQ = "playin432_lite_hq_month"; // JSON { key, used }
const EVT = "playin432-pro-change";

export type ProState = {
  tier: TierId;
  /** True when tier is pro (legacy + batch/unlimited). */
  isPro: boolean;
  /** True when tier is lite or pro (all frequencies). */
  isLiteOrPro: boolean;
  sessionId: string | null;
  hqUsed: number;
  hqRemaining: number;
  hqPeriodLabel: string;
};

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function readLegacyPro(): boolean {
  try {
    return localStorage.getItem(LS_PRO) === "1";
  } catch {
    return false;
  }
}

export function getTier(): TierId {
  try {
    const t = parseTier(localStorage.getItem(LS_TIER));
    if (t !== "free") return t;
    // Migrate legacy Pro flag
    if (readLegacyPro()) return "pro";
    return "free";
  } catch {
    return readLegacyPro() ? "pro" : "free";
  }
}

/** @deprecated Prefer getTier() — true only for full Pro. */
export function isPro(): boolean {
  return getTier() === "pro";
}

export function isLiteOrPro(): boolean {
  return tierAtLeast(getTier(), "lite");
}

export function getProSessionId(): string | null {
  try {
    return localStorage.getItem(LS_PRO_SESSION);
  } catch {
    return null;
  }
}

export function getHqExportsUsedLifetime(): number {
  try {
    const n = Number(localStorage.getItem(LS_HQ_USED) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** @deprecated use getHqExportsUsedLifetime */
export const getHqExportsUsed = getHqExportsUsedLifetime;

function getLiteMonthUsage(): { key: string; used: number } {
  const key = monthKey();
  try {
    const raw = localStorage.getItem(LS_LITE_HQ);
    if (!raw) return { key, used: 0 };
    const j = JSON.parse(raw) as { key?: string; used?: number };
    if (j.key !== key) return { key, used: 0 };
    const used = Number(j.used ?? 0);
    return { key, used: Number.isFinite(used) && used > 0 ? Math.floor(used) : 0 };
  } catch {
    return { key, used: 0 };
  }
}

export function getProState(): ProState {
  const tier = getTier();
  const flags = featuresForTier(tier);
  let hqUsed = 0;
  let hqRemaining = Number.POSITIVE_INFINITY;
  let hqPeriodLabel = "unlimited";

  if (tier === "pro") {
    hqPeriodLabel = "unlimited";
  } else if (tier === "lite") {
    const m = getLiteMonthUsage();
    hqUsed = m.used;
    hqRemaining = Math.max(0, LITE_HQ_EXPORTS_PER_MONTH - m.used);
    hqPeriodLabel = "this month";
  } else {
    hqUsed = getHqExportsUsedLifetime();
    hqRemaining = Math.max(0, FREE_HQ_EXPORT_LIMIT - hqUsed);
    hqPeriodLabel = "lifetime free";
  }

  return {
    tier,
    isPro: tier === "pro",
    isLiteOrPro: tierAtLeast(tier, "lite"),
    sessionId: getProSessionId(),
    hqUsed,
    hqRemaining: flags.unlimitedHq ? Number.POSITIVE_INFINITY : hqRemaining,
    hqPeriodLabel,
  };
}

function emitChange() {
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* ignore */
  }
}

export function subscribePro(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}

function writeTier(tier: TierId, sessionId: string | null) {
  try {
    localStorage.setItem(LS_TIER, tier);
    if (tier === "pro") localStorage.setItem(LS_PRO, "1");
    else localStorage.removeItem(LS_PRO);
    if (sessionId) localStorage.setItem(LS_PRO_SESSION, sessionId);
  } catch {
    /* private mode */
  }
  void persistTierToDb(tier, sessionId);
  emitChange();
}

/** Activate Lite or Pro after Stripe / gift / IAP verification. */
export function activateTier(tier: TierId, sessionId: string) {
  if (tier !== "lite" && tier !== "pro") return;
  // Never downgrade pro → lite on activate
  if (getTier() === "pro" && tier === "lite") {
    writeTier("pro", sessionId || getProSessionId() || "keep");
    return;
  }
  writeTier(tier, sessionId);
}

/** Mark Pro after Stripe session verification succeeds (legacy). */
export function activatePro(sessionId: string) {
  activateTier("pro", sessionId);
}

export function activateLite(sessionId: string) {
  activateTier("lite", sessionId);
}

/** Dev / support only — not exposed in UI. */
export function deactivatePro() {
  try {
    localStorage.removeItem(LS_TIER);
    localStorage.removeItem(LS_PRO);
    localStorage.removeItem(LS_PRO_SESSION);
  } catch {
    /* ignore */
  }
  void persistTierToDb("free", null);
  emitChange();
}

async function persistTierToDb(tier: TierId, sessionId: string | null) {
  try {
    const { openDbForPro } = await import("./db");
    // Store session for pro/lite; null clears
    await openDbForPro(tier === "free" ? null : sessionId || tier);
    // Also store tier string in settings if available
    try {
      localStorage.setItem(LS_TIER, tier);
    } catch {
      /* ignore */
    }
  } catch {
    /* optional backup */
  }
}

export async function hydrateProFromBackup(): Promise<boolean> {
  if (getTier() !== "free") return true;
  try {
    const { loadProFromDb } = await import("./db");
    const sessionId = await loadProFromDb();
    if (sessionId) {
      // Legacy backup only stored session — treat as Pro
      activatePro(sessionId);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function isTargetHzFree(hz: number): boolean {
  return FREE_TARGET_HZ.some((f) => Math.abs(f - hz) < 0.5);
}

export function canUseTargetHz(hz: number): boolean {
  return isLiteOrPro() || isTargetHzFree(hz);
}

export function canBatchExport(): boolean {
  return getTier() === "pro";
}

export function canShareOwnClip(): boolean {
  return getTier() === "pro";
}

export type ExportGate =
  | { ok: true; remaining: number; period: string }
  | { ok: false; reason: "limit"; used: number; limit: number; period: string };

export function canExportHq(): ExportGate {
  const tier = getTier();
  if (tier === "pro") {
    return {
      ok: true,
      remaining: Number.POSITIVE_INFINITY,
      period: "unlimited",
    };
  }
  if (tier === "lite") {
    const m = getLiteMonthUsage();
    if (m.used >= LITE_HQ_EXPORTS_PER_MONTH) {
      return {
        ok: false,
        reason: "limit",
        used: m.used,
        limit: LITE_HQ_EXPORTS_PER_MONTH,
        period: "month",
      };
    }
    return {
      ok: true,
      remaining: LITE_HQ_EXPORTS_PER_MONTH - m.used,
      period: "month",
    };
  }
  const used = getHqExportsUsedLifetime();
  if (used >= FREE_HQ_EXPORT_LIMIT) {
    return {
      ok: false,
      reason: "limit",
      used,
      limit: FREE_HQ_EXPORT_LIMIT,
      period: "lifetime",
    };
  }
  return {
    ok: true,
    remaining: FREE_HQ_EXPORT_LIMIT - used,
    period: "lifetime",
  };
}

export function recordHqExport() {
  const tier = getTier();
  if (tier === "pro") return;
  try {
    if (tier === "lite") {
      const m = getLiteMonthUsage();
      localStorage.setItem(
        LS_LITE_HQ,
        JSON.stringify({ key: m.key, used: m.used + 1 }),
      );
    } else {
      const next = getHqExportsUsedLifetime() + 1;
      localStorage.setItem(LS_HQ_USED, String(next));
    }
  } catch {
    /* ignore */
  }
  emitChange();
}

const PROD_API = "https://playin432.com";

function isCapacitorShell(): boolean {
  try {
    const w = window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
      };
    };
    if (w.Capacitor?.isNativePlatform?.()) return true;
    const p = w.Capacitor?.getPlatform?.();
    if (p === "ios" || p === "android") return true;
  } catch {
    /* ignore */
  }
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  if (protocol === "capacitor:" || protocol === "ionic:") return true;
  if (
    (hostname === "localhost" || hostname === "127.0.0.1") &&
    (!window.location.port ||
      window.location.port === "" ||
      window.location.port === "443")
  ) {
    return Boolean(
      (window as unknown as { Capacitor?: unknown }).Capacitor,
    );
  }
  return false;
}

function apiBase(): string {
  const override = (
    import.meta.env.VITE_API_BASE as string | undefined
  )?.trim();
  if (override) return override.replace(/\/$/, "");

  if (isCapacitorShell()) return PROD_API;

  if (typeof window !== "undefined" && window.location?.origin) {
    const o = window.location.origin;
    if (
      o.startsWith("http") &&
      !o.includes("localhost") &&
      !o.includes("127.0.0.1")
    ) {
      return o;
    }
  }
  return PROD_API;
}

function apiUrl(path: string): string {
  const base = apiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export type CheckoutOptions = {
  /** lite | pro — default pro */
  tier?: "lite" | "pro";
  /** Gift purchase — success page shows a redeem code for the recipient */
  gift?: boolean;
};

export async function startCheckoutStripe(
  opts: CheckoutOptions = {},
): Promise<void> {
  const tier = opts.tier === "lite" ? "lite" : "pro";
  const gift = Boolean(opts.gift);

  // Fixed payment links only for non-gift Pro (legacy)
  if (tier === "pro" && !gift) {
    const link = (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined)
      ?.trim();
    if (link) {
      try {
        const { openExternalUrl, isNativeApp } = await import("./native");
        if (isNativeApp()) {
          await openExternalUrl(link);
          return;
        }
      } catch {
        /* web */
      }
      window.location.href = link;
      return;
    }
  }

  let successUrl: string | undefined;
  let cancelUrl: string | undefined;
  try {
    const { isNativeApp } = await import("./native");
    if (isNativeApp()) {
      successUrl =
        "playin432://?checkout=success&session_id={CHECKOUT_SESSION_ID}";
      cancelUrl = "playin432://?checkout=cancel";
    }
  } catch {
    /* web */
  }

  const url = apiUrl("/api/create-checkout-session");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        successPath: gift
          ? "/?checkout=success&gift=1"
          : "/?checkout=success",
        cancelPath: "/?checkout=cancel",
        successUrl,
        cancelUrl,
        tier,
        gift,
      }),
    });
  } catch {
    throw new Error(
      `Network error reaching checkout (${url}). Check your connection.`,
    );
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      body?.error || `Checkout unavailable (${res.status}). Tried ${url}`,
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("No checkout URL returned from Stripe.");

  try {
    const { openExternalUrl, isNativeApp } = await import("./native");
    if (isNativeApp()) {
      await openExternalUrl(data.url);
      return;
    }
  } catch (e) {
    console.warn("[Pro] external open failed", e);
  }
  window.location.href = data.url;
}

export async function startCheckout(
  opts: CheckoutOptions = {},
): Promise<void> {
  const tier = opts.tier === "lite" ? "lite" : "pro";
  // Gifts always use Stripe (email redeem code)
  if (opts.gift) {
    await startCheckoutStripe(opts);
    return;
  }

  const rc = await import("./revenueCat");
  if (rc.isRevenueCatNative()) {
    // Native (iOS/Android) MUST use StoreKit / Play Billing for digital
    // unlocks. Never fall back to external Stripe web checkout: it violates
    // App Store Guideline 3.1.1 and presents as an indefinite loading spinner
    // in review. On failure, surface the error to the UI (Restore is offered
    // separately) rather than redirecting off-platform.
    const ok = await rc.purchaseTier(tier);
    if (!ok) {
      throw new Error(
        "Purchase didn’t unlock access. If you were charged, tap Restore Purchases.",
      );
    }
    return;
  }
  await startCheckoutStripe(opts);
}

export async function restorePurchases(): Promise<boolean> {
  const rc = await import("./revenueCat");
  if (!rc.isRevenueCatNative()) {
    throw new Error("Restore is only available in the iOS / Android app.");
  }
  return rc.restorePurchases();
}

export type RestoreInput = {
  email?: string;
  sessionId?: string;
  /** Gift / redeem code (cs_… session id or PI432-… token) */
  code?: string;
};

export async function restoreProAccess(
  input: RestoreInput = {},
): Promise<{
  ok: boolean;
  error?: string;
  source?: "store" | "stripe" | "gift";
  tier?: TierId;
}> {
  const email = input.email?.trim() || "";
  const sessionId = (input.sessionId || input.code || "").trim();

  if (!email && !sessionId) {
    try {
      const rc = await import("./revenueCat");
      if (rc.isRevenueCatNative()) {
        const ok = await rc.restorePurchases();
        if (ok) {
          return { ok: true, source: "store", tier: getTier() };
        }
        return {
          ok: false,
          error:
            "No App Store / Play purchase found. If you paid by card, enter the email from your Stripe receipt.",
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/only available/i.test(msg)) console.warn("[Pro] store restore", e);
    }
    return {
      ok: false,
      error:
        "Enter the email you used at Stripe checkout, or a gift/session code from your receipt.",
    };
  }

  const url = apiUrl("/api/restore-pro");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email || undefined,
        sessionId: sessionId || undefined,
      }),
    });
  } catch {
    return {
      ok: false,
      error: `Network error reaching restore (${url}). Check your connection.`,
    };
  }

  const body = (await res.json().catch(() => null)) as {
    paid?: boolean;
    sessionId?: string;
    tier?: string;
    error?: string;
  } | null;

  if (!res.ok || !body?.paid || !body.sessionId) {
    return {
      ok: false,
      error: body?.error || `Restore failed (${res.status})`,
    };
  }

  const tier = parseTier(body.tier === "lite" ? "lite" : "pro");
  const active: TierId = tier === "lite" ? "lite" : "pro";
  activateTier(active, body.sessionId);
  return {
    ok: true,
    source: body.tier ? "gift" : "stripe",
    tier: active,
  };
}

export async function verifyCheckoutSession(sessionId: string): Promise<{
  ok: boolean;
  error?: string;
  tier?: TierId;
  giftCode?: string;
  /** Unlock code (Stripe session id) for a non-gift purchase. */
  code?: string;
  /** Buyer email the unlock code was emailed to (non-gift). */
  email?: string | null;
}> {
  const res = await fetch(apiUrl("/api/verify-checkout-session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { ok: false, error: body?.error || `Verify failed (${res.status})` };
  }

  const data = (await res.json()) as {
    paid?: boolean;
    sessionId?: string;
    tier?: string;
    gift?: boolean;
    giftCode?: string;
    email?: string | null;
  };

  if (data.paid && data.sessionId) {
    const tier: TierId = data.tier === "lite" ? "lite" : "pro";
    // Gift purchases: gifter should NOT auto-activate on their device
    if (data.gift) {
      return {
        ok: true,
        tier,
        giftCode: data.giftCode || data.sessionId,
      };
    }
    activateTier(tier, data.sessionId);
    return { ok: true, tier, code: data.sessionId, email: data.email ?? null };
  }
  return { ok: false, error: "Payment not completed." };
}

export async function handleCheckoutReturn(
  search: string,
): Promise<
  | "cancel"
  | "none"
  | "error"
  | { kind: "activated"; code: string | null; email: string | null; tier: TierId }
  | { kind: "gift"; code: string; tier: TierId }
> {
  const params = new URLSearchParams(search);
  const status = params.get("checkout");
  if (status === "cancel") return "cancel";
  if (status !== "success") return "none";

  const sessionId =
    params.get("session_id") || params.get("sessionId") || "";
  if (!sessionId) {
    if (import.meta.env.VITE_STRIPE_TRUST_SUCCESS_PARAM === "1") {
      activatePro(`link_${Date.now()}`);
      return { kind: "activated", code: null, email: null, tier: "pro" };
    }
    return "error";
  }

  const result = await verifyCheckoutSession(sessionId);
  if (!result.ok) return "error";
  if (result.giftCode) {
    return {
      kind: "gift",
      code: result.giftCode,
      tier: result.tier || "pro",
    };
  }
  return {
    kind: "activated",
    code: result.code ?? null,
    email: result.email ?? null,
    tier: result.tier || "pro",
  };
}

export function stripCheckoutParams() {
  try {
    const url = new URL(window.location.href);
    if (
      !url.searchParams.has("checkout") &&
      !url.searchParams.has("session_id")
    ) {
      return;
    }
    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");
    url.searchParams.delete("sessionId");
    url.searchParams.delete("gift");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}
