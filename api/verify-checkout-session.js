/**
 * Vercel Serverless — verify Stripe Checkout Session paid → client activates tier.
 *
 * Also sends the gift redemption email (folded in from the former
 * api/send-gift-email.js relay, which is removed) so there is no
 * unauthenticated public email endpoint. The gift email is sent at most
 * once per session, guarded by a `gift_email_sent` flag written back to the
 * Stripe session metadata. The buyer's own unlock email is sent by
 * api/stripe-webhook.js (durable path); this endpoint returns the buyer
 * email so the success screen can show where it was sent.
 *
 * Env: STRIPE_SECRET_KEY (required)
 *      RESEND_API_KEY (optional — gift email only sent when present)
 *      GIFT_FROM_EMAIL (optional sender, e.g. gifts@playin432.com)
 */
import Stripe from "stripe";
import { setCors } from "./_lib/cors.js";
import { sendGiftEmail } from "./_lib/email.js";
import { tierFromSession } from "./_lib/tier.js";

export default async function handler(req, res) {
  setCors(req, res);

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
    const giftCode = gift ? session.id : undefined;

    // Send the gift email at most once. Only for genuinely-paid gift
    // sessions, and only when it has not already been sent for this session.
    let emailed = false;
    const alreadySent = session.metadata?.gift_email_sent === "1";
    if (
      gift &&
      giftCode &&
      session.payment_status === "paid" &&
      !alreadySent &&
      process.env.RESEND_API_KEY
    ) {
      try {
        const custom = session.custom_fields || [];
        const field = custom.find((f) => f.key === "recipient_email");
        const recipient =
          field?.text?.value || session.metadata?.recipient_email || null;
        if (recipient && String(recipient).includes("@")) {
          emailed = await sendGiftEmail({
            to: String(recipient).trim().toLowerCase(),
            tier,
            giftCode,
            fromName:
              session.metadata?.from_name ||
              session.customer_details?.name ||
              "Someone",
          });
          if (emailed) {
            // Replay guard: mark the session so a repeat verify call (or a
            // page refresh) does not send a second email.
            await stripe.checkout.sessions.update(session.id, {
              metadata: { gift_email_sent: "1" },
            });
          }
        }
      } catch (e) {
        console.warn("gift email skip", e);
      }
    }

    return res.status(200).json({
      paid: true,
      sessionId: session.id,
      amount_total: session.amount_total,
      currency: session.currency,
      tier,
      gift,
      giftCode,
      email: session.customer_details?.email || null,
      emailed: emailed || alreadySent,
    });
  } catch (err) {
    console.error("verify-checkout-session", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
