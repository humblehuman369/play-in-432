/**
 * Vercel Serverless — create Stripe Checkout Session (Lite / Pro, optional gift).
 * Env: STRIPE_SECRET_KEY (required)
 *      STRIPE_PRICE_ID (optional Pro fixed price)
 *      STRIPE_LITE_PRICE_ID (optional Lite fixed price)
 *      APP_URL (optional production origin override)
 */
import Stripe from "stripe";

const TIERS = {
  pro: {
    cents: 1900,
    name: "Play In 432 — TrueHz Pro",
    desc: "Lifetime unlock: all frequency targets + unlimited TrueHz Convert HQ export + batch export. One-time payment.",
    product: "truehz_pro",
    envPrice: "STRIPE_PRICE_ID",
  },
  lite: {
    cents: 999,
    name: "Play In 432 — TrueHz Lite",
    desc: "One-time unlock: all Solfeggio & custom targets + 10 HQ exports per month.",
    product: "truehz_lite",
    envPrice: "STRIPE_LITE_PRICE_ID",
  },
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function originFromReq(req) {
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

    const tier = body.tier === "lite" ? "lite" : "pro";
    const gift = Boolean(body.gift);
    const cfg = TIERS[tier];

    const origin = originFromReq(req);
    const successPath =
      body.successPath ||
      (gift ? "/?checkout=success&gift=1" : "/?checkout=success");
    const cancelPath = body.cancelPath || "/?checkout=cancel";

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

    if (
      !success_url.includes("{CHECKOUT_SESSION_ID}") &&
      !success_url.includes("session_id=")
    ) {
      success_url +=
        (success_url.includes("?") ? "&" : "?") +
        "session_id={CHECKOUT_SESSION_ID}";
    }

    const priceId = process.env[cfg.envPrice]?.trim();
    const line_items = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              unit_amount: cfg.cents,
              product_data: {
                name: gift ? `${cfg.name} (Gift)` : cfg.name,
                description: gift
                  ? `${cfg.desc} Gift purchase — recipient redeems with the session code.`
                  : cfg.desc,
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
        product: cfg.product,
        tier,
        gift: gift ? "1" : "0",
        app: "play-in-432",
      },
    });

    return res.status(200).json({ url: session.url, id: session.id, tier, gift });
  } catch (err) {
    console.error("create-checkout-session", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Checkout failed",
    });
  }
}
