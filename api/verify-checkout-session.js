/**
 * Vercel Serverless — verify Stripe Checkout Session paid → client activates tier.
 * Env: STRIPE_SECRET_KEY
 */
import Stripe from "stripe";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function tierFromSession(session) {
  const meta = session.metadata || {};
  if (meta.tier === "lite" || meta.product === "truehz_lite") return "lite";
  if (meta.tier === "pro" || meta.product === "truehz_pro") return "pro";
  const amount = session.amount_total ?? 0;
  if (amount > 0 && amount < 1500) return "lite";
  return "pro";
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
    return res.status(503).json({ error: "Stripe is not configured." });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const sessionId = body.sessionId || body.session_id;
    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ error: "sessionId required" });
    }
    if (!sessionId.startsWith("cs_")) {
      return res.status(400).json({ error: "Invalid session id" });
    }

    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid =
      session.payment_status === "paid" || session.status === "complete";

    if (!paid) {
      return res.status(200).json({
        paid: false,
        status: session.status,
        payment_status: session.payment_status,
      });
    }

    const tier = tierFromSession(session);
    const gift = session.metadata?.gift === "1";

    return res.status(200).json({
      paid: true,
      sessionId: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      tier,
      gift,
      // Session id is the redeem code for gifts (share with recipient)
      giftCode: gift ? session.id : undefined,
    });
  } catch (err) {
    console.error("verify-checkout-session", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Verify failed",
    });
  }
}
