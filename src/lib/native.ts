/**
 * Capacitor / native shell helpers (no-ops on pure web).
 */
import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getNativePlatform(): "ios" | "android" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "ios" || p === "android") return p;
  } catch {
    /* web */
  }
  return "web";
}

/** Stripe / OAuth return deep link scheme (registered in Info.plist). */
export const APP_URL_SCHEME = "playin432";

/**
 * Apply a deep-link URL into the in-app SPA location (same origin / IndexedDB).
 * Never navigate the WebView to an external origin.
 */
export function applyDeepLinkUrl(url: string): void {
  try {
    const u = new URL(url);
    const isAppScheme = u.protocol === `${APP_URL_SCHEME}:`;
    const isProdHost =
      u.hostname === "playin432.com" || u.hostname === "www.playin432.com";
    if (!isAppScheme && !isProdHost) return;

    // playin432://?checkout=success&session_id=…  or  playin432://checkout?…
    const search = u.search || "";
    const hash = u.hash || "";
    let path = u.pathname || "/";
    // Custom schemes often put a host-like first segment: playin432://checkout
    if (isAppScheme && u.hostname && u.hostname !== "localhost") {
      path = `/${u.hostname}${path === "/" ? "" : path}`;
    }
    if (!path.startsWith("/")) path = `/${path}`;

    const next = path + search + hash;
    const cur = window.location.pathname + window.location.search + window.location.hash;
    if (next !== cur) {
      window.history.replaceState({}, "", next);
    }
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.dispatchEvent(new Event("playin432-deep-link"));
  } catch (err) {
    console.warn("applyDeepLinkUrl", err);
  }
}

/** Configure status bar + splash once the UI mounts. */
export async function initNativeShell(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (getNativePlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#070b0f" });
    }
  } catch (e) {
    console.warn("StatusBar init", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* optional */
  }

  // Deep links (Stripe return, Spotify) — keep WebView on local origin
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appUrlOpen", ({ url }) => {
      applyDeepLinkUrl(url);
      // Close in-app browser if we opened Stripe there
      void import("@capacitor/browser")
        .then(({ Browser }) => Browser.close())
        .catch(() => undefined);
    });
  } catch (e) {
    console.warn("App listener", e);
  }
}

/**
 * Open Stripe / external URLs WITHOUT navigating the Capacitor WebView.
 * Navigating the WebView to Stripe → playin432.com wipes the in-app
 * IndexedDB library (different origin than https://localhost).
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isNativeApp()) {
    window.location.href = url;
    return;
  }

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({
      url,
      presentationStyle: "popover",
    });
    return;
  } catch (e) {
    console.warn("Browser.open failed, trying window.open", e);
  }

  // window.open only — never assign window.location (that destroys library)
  const w = window.open(url, "_blank");
  if (!w) {
    throw new Error(
      "Could not open the payment page. Allow pop-ups, or try again from Safari at playin432.com.",
    );
  }
}
