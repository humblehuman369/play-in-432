/**
 * Vercel Serverless — create Stripe Checkout Session (one-time TrueHz Pro).
 * Env: STRIPE_SECRET_KEY (required), STRIPE_PRICE_ID (optional),
 *      APP_URL (optional production origin override)
 *
 * CORS: required for Capacitor WebView (origin https://localhost) and local dev.
 */
import Stripe from "stripe";

const PRICE_CENTS = 1900;
const PRODUCT_NAME = "Play In 432 — TrueHz Pro";
const PRODUCT_DESC =
  "Lifetime unlock: all frequency targets + unlimited TrueHz Convert HQ WAV export. One-time payment.";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function originFromReq(req) {
  // Prefer explicit production app URL for success/cancel redirects
  // (Capacitor origin is localhost — never use that for Stripe return URLs)
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host && !/localhost|127\.0\.0\.1/i.test(String(host))) {
    return `${proto}://${host}`;
  }
  return "https://playin432.com";
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return res.status(503).json({
      error:
        "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel project env.",
    });
  }

  try {
    const stripe = new Stripe(key);
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const origin = originFromReq(req);
    const successPath = body.successPath || "/?checkout=success";
    const cancelPath = body.cancelPath || "/?checkout=cancel";

    // Native apps pass playin432:// deep links so WebView never leaves local origin
    // (navigating WebView to Stripe/playin432.com wipes IndexedDB library).
    const allowUrl = (u) => {
      if (typeof u !== "string" || !u.trim()) return false;
      try {
        const parsed = new URL(u.replace("{CHECKOUT_SESSION_ID}", "cs_x"));
        if (parsed.protocol === "playin432:") return true;
        if (
          parsed.protocol === "https:" &&
          (parsed.hostname === "playin432.com" ||
            parsed.hostname === "www.playin432.com" ||
            parsed.hostname.endsWith(".vercel.app"))
        ) {
          return true;
        }
      } catch {
        return false;
      }
      return false;
    };

    let success_url = allowUrl(body.successUrl)
      ? String(body.successUrl).trim()
      : `${origin}${successPath}${
          successPath.includes("?") ? "&" : "?"
        }session_id={CHECKOUT_SESSION_ID}`;
    let cancel_url = allowUrl(body.cancelUrl)
      ? String(body.cancelUrl).trim()
      : `${origin}${cancelPath}`;

    // Ensure Stripe template token is present for success
    if (
      !success_url.includes("{CHECKOUT_SESSION_ID}") &&
      !success_url.includes("session_id=")
    ) {
      success_url +=
        (success_url.includes("?") ? "&" : "?") +
        "session_id={CHECKOUT_SESSION_ID}";
    }

    const priceId = process.env.STRIPE_PRICE_ID?.trim();

    const line_items = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              unit_amount: PRICE_CENTS,
              product_data: {
                name: PRODUCT_NAME,
                description: PRODUCT_DESC,
              },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url,
      cancel_url,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        product: "truehz_pro",
        app: "play-in-432",
      },
    });

    return res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("create-checkout-session", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Checkout failed",
    });
  }
}
