/**
 * Shared CORS for the browser-callable API handlers.
 *
 * Replaces the wildcard `Access-Control-Allow-Origin: *` with an origin
 * allowlist: production site + www, Vercel preview deploys, and the
 * Capacitor / native origins. The matched origin is echoed back; if the
 * request origin is not allowed, no ACAO header is sent (same-origin and
 * server-to-server callers don't need it).
 *
 * Not used by api/stripe-webhook.js — that is called by Stripe, not a
 * browser, so it has no Origin and needs no CORS.
 */
const STATIC_ALLOWED = new Set([
  "https://playin432.com",
  "https://www.playin432.com",
  // Capacitor iOS webview origin (native app API calls)
  "capacitor://localhost",
  "ionic://localhost",
]);

export function isAllowedOrigin(origin) {
  if (!origin || typeof origin !== "string") return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  try {
    const u = new URL(origin);
    // Custom app scheme (deep-link origin), e.g. playin432://…
    if (u.protocol === "playin432:") return true;
    // Vercel preview deploys: https://<anything>.vercel.app
    if (u.protocol === "https:" && u.hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Set CORS headers on the response. Echoes the request origin only when it
 * is on the allowlist; otherwise the ACAO header is omitted entirely.
 */
export function setCors(req, res) {
  const origin = req.headers?.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
