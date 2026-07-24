/**
 * TrueHz Pro entitlement (client-side + Stripe Checkout).
 *
 * Free forever: live A=432 / A=440, library, playlists, Learn, limited HQ exports.
 * Pro ($19 one-time): all frequency targets + unlimited TrueHz Convert HQ.
 *
 * Note: localStorage can be spoofed. v1 trusts verified Stripe sessions.
 * Future: license server / signed JWT if abuse appears.
 */

export const PRO_PRICE_USD = 19;
export const PRO_PRICE_LABEL = "$19";
export const PRO_PRICE_CENTS = 1900;
export const FREE_HQ_EXPORT_LIMIT = 3;

/** Free tier may set these as concert-reference targets without Pro. */
export const FREE_TARGET_HZ = [432, 440] as const;

const LS_PRO = "playin432_pro";
const LS_PRO_SESSION = "playin432_pro_session";
const LS_HQ_USED = "playin432_hq_exports_used";
const EVT = "playin432-pro-change";

export type ProState = {
  isPro: boolean;
  sessionId: string | null;
  hqUsed: number;
  hqRemaining: number;
};

function readJsonFlag(): boolean {
  try {
    return localStorage.getItem(LS_PRO) === "1";
  } catch {
    return false;
  }
}

export function isPro(): boolean {
  return readJsonFlag();
}

export function getProSessionId(): string | null {
  try {
    return localStorage.getItem(LS_PRO_SESSION);
  } catch {
    return null;
  }
}

export function getHqExportsUsed(): number {
  try {
    const n = Number(localStorage.getItem(LS_HQ_USED) ?? "0");
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function getProState(): ProState {
  const pro = isPro();
  const hqUsed = getHqExportsUsed();
  return {
    isPro: pro,
    sessionId: getProSessionId(),
    hqUsed,
    hqRemaining: pro
      ? Number.POSITIVE_INFINITY
      : Math.max(0, FREE_HQ_EXPORT_LIMIT - hqUsed),
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

/** Mark Pro after Stripe session verification succeeds. */
export function activatePro(sessionId: string) {
  try {
    localStorage.setItem(LS_PRO, "1");
    localStorage.setItem(LS_PRO_SESSION, sessionId);
  } catch {
    /* private mode */
  }
  // Mirror into IndexedDB so Pro survives some WebView storage glitches
  void persistProToDb(sessionId);
  emitChange();
}

/** Dev / support only — not exposed in UI. */
export function deactivatePro() {
  try {
    localStorage.removeItem(LS_PRO);
    localStorage.removeItem(LS_PRO_SESSION);
  } catch {
    /* ignore */
  }
  void persistProToDb(null);
  emitChange();
}

async function persistProToDb(sessionId: string | null) {
  try {
    const { openDbForPro } = await import("./db");
    await openDbForPro(sessionId);
  } catch {
    /* optional backup */
  }
}

/**
 * On launch: if localStorage lost Pro but IndexedDB still has it, restore flag.
 * (Does not restore across web ↔ native origin — use restoreProAccess for that.)
 */
export async function hydrateProFromBackup(): Promise<boolean> {
  if (isPro()) return true;
  try {
    const { loadProFromDb } = await import("./db");
    const sessionId = await loadProFromDb();
    if (sessionId) {
      try {
        localStorage.setItem(LS_PRO, "1");
        localStorage.setItem(LS_PRO_SESSION, sessionId);
      } catch {
        /* ignore */
      }
      emitChange();
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
  return isPro() || isTargetHzFree(hz);
}

export type ExportGate =
  | { ok: true; remaining: number }
  | { ok: false; reason: "limit"; used: number; limit: number };

export function canExportHq(): ExportGate {
  if (isPro()) return { ok: true, remaining: Number.POSITIVE_INFINITY };
  const used = getHqExportsUsed();
  if (used >= FREE_HQ_EXPORT_LIMIT) {
    return { ok: false, reason: "limit", used, limit: FREE_HQ_EXPORT_LIMIT };
  }
  return { ok: true, remaining: FREE_HQ_EXPORT_LIMIT - used };
}

export function recordHqExport() {
  if (isPro()) return;
  try {
    const next = getHqExportsUsed() + 1;
    localStorage.setItem(LS_HQ_USED, String(next));
  } catch {
    /* ignore */
  }
  emitChange();
}

const PROD_API = "https://playin432.com";

/** True when running inside Capacitor (iOS/Android shell). */
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
  // Capacitor 6+ often uses https://localhost as the WebView origin
  if (
    (hostname === "localhost" || hostname === "127.0.0.1") &&
    // Heuristic: not a Vite dev server (those use :5173 etc.)
    (!window.location.port || window.location.port === "" || window.location.port === "443")
  ) {
    // Only treat as shell if Capacitor global exists
    return Boolean(
      (window as unknown as { Capacitor?: unknown }).Capacitor,
    );
  }
  return false;
}

/**
 * API origin for Stripe checkout.
 * Always use production when local / Capacitor so /api is never hit on localhost.
 */
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
  // Local vite / preview → production Stripe API
  return PROD_API;
}

function apiUrl(path: string): string {
  const base = apiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Stripe Checkout (web / desktop browsers, and native fallback). */
export async function startCheckoutStripe(): Promise<void> {
  const link = (import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined)
    ?.trim();
  if (link) {
    // Payment Link has fixed return URLs — still open externally on native
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

  // Native: deep-link back into the app (same IndexedDB origin).
  // Web: stay on playin432.com.
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
        successPath: "/?checkout=success",
        cancelPath: "/?checkout=cancel",
        successUrl,
        cancelUrl,
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
      body?.error ||
        `Checkout unavailable (${res.status}). Tried ${url}`,
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("No checkout URL returned from Stripe.");

  // Native: open Stripe in Browser plugin — NEVER window.location (wipes library)
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

/**
 * Start Pro unlock:
 * - Native (Capacitor): RevenueCat / App Store / Play Billing
 * - Web: Stripe Checkout
 * - If RevenueCat is missing products/keys, fall back to Stripe (production API)
 */
export async function startCheckout(): Promise<void> {
  const rc = await import("./revenueCat");
  if (rc.isRevenueCatNative()) {
    try {
      const ok = await rc.purchaseDefaultPro();
      if (!ok) throw new Error("Purchase completed but Pro was not unlocked.");
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // User canceled — don't fall through to Stripe
      if (/cancel/i.test(msg)) throw e;
      // Missing RC config / packages → Stripe so unlock still works
      console.warn("[Pro] RevenueCat purchase failed, trying Stripe:", msg);
      await startCheckoutStripe();
      return;
    }
  }
  await startCheckoutStripe();
}

/** Restore App Store / Play purchases (native only). */
export async function restorePurchases(): Promise<boolean> {
  const rc = await import("./revenueCat");
  if (!rc.isRevenueCatNative()) {
    throw new Error("Restore is only available in the iOS / Android app.");
  }
  return rc.restorePurchases();
}

export type RestoreInput = {
  /** Email used at Stripe Checkout */
  email?: string;
  /** Stripe Checkout Session id (cs_live_… / cs_test_…) */
  sessionId?: string;
};

/**
 * Restore Pro on this device:
 * 1) App Store / Play (RevenueCat) when native
 * 2) Stripe by email or session id (card checkout)
 */
export async function restoreProAccess(
  input: RestoreInput = {},
): Promise<{ ok: boolean; error?: string; source?: "store" | "stripe" }> {
  const email = input.email?.trim() || "";
  const sessionId = input.sessionId?.trim() || "";

  // 1) Store restore first when no Stripe credentials provided
  if (!email && !sessionId) {
    try {
      const rc = await import("./revenueCat");
      if (rc.isRevenueCatNative()) {
        const ok = await rc.restorePurchases();
        if (ok) return { ok: true, source: "store" };
        return {
          ok: false,
          error:
            "No App Store / Play purchase found. If you paid by card, enter the email from your Stripe receipt.",
        };
      }
    } catch (e) {
      /* fall through to stripe message */
      const msg = e instanceof Error ? e.message : String(e);
      if (!/only available/i.test(msg)) {
        console.warn("[Pro] store restore", e);
      }
    }
    return {
      ok: false,
      error:
        "Enter the email you used at Stripe checkout (or a session id from the receipt) to restore Pro.",
    };
  }

  // 2) Stripe restore by email / session
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
    error?: string;
  } | null;

  if (!res.ok || !body?.paid || !body.sessionId) {
    return {
      ok: false,
      error: body?.error || `Restore failed (${res.status})`,
    };
  }

  activatePro(body.sessionId);
  return { ok: true, source: "stripe" };
}

/** Verify a Checkout Session id and activate Pro if paid. */
export async function verifyCheckoutSession(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
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
  };

  if (data.paid && data.sessionId) {
    activatePro(data.sessionId);
    return { ok: true };
  }
  return { ok: false, error: "Payment not completed." };
}

/** Parse return URL from Stripe and verify once. */
export async function handleCheckoutReturn(
  search: string,
): Promise<"activated" | "cancel" | "none" | "error"> {
  const params = new URLSearchParams(search);
  const status = params.get("checkout");
  if (status === "cancel") return "cancel";
  if (status !== "success") return "none";

  const sessionId =
    params.get("session_id") || params.get("sessionId") || "";
  if (!sessionId) {
    // Payment Link may not pass session_id — honor success if configured
    if (import.meta.env.VITE_STRIPE_TRUST_SUCCESS_PARAM === "1") {
      activatePro(`link_${Date.now()}`);
      return "activated";
    }
    return "error";
  }

  const result = await verifyCheckoutSession(sessionId);
  return result.ok ? "activated" : "error";
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
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}
