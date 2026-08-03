/**
 * Vercel Serverless — Stripe webhook (durable purchase delivery).
 *
 * Handles checkout.session.completed. The Stripe-Signature header is verified
 * against STRIPE_WEBHOOK_SECRET using the RAW request body, so body parsing
 * MUST be disabled (see `config` below) — a parsed/re-serialized body would
 * fail signature verification.
 *
 * On a completed, paid session this guarantees delivery of the unlock code by
 * email even if the buyer closed the tab before the success redirect:
 *   - non-gift → email the buyer their unlock/license code (sendUnlockEmail)
 *   - gift     → email the recipient their redemption code (sendGiftEmail),
 *                as a backup to the redirect/verify path.
 * Both are guarded by metadata flags (buyer_email_sent / gift_email_sent) so
 * Stripe's webhook retries and the redirect flow don't double-send.
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY (optional).
 */
import Stripe from "stripe";
import { sendGiftEmail, sendUnlockEmail } from "./_lib/email.js";
import { tierFromSession } from "./_lib/tier.js";

// Vercel Node runtime: disable automatic body parsing so we can read the raw
// bytes Stripe signed. Required for stripe.webhooks.constructEvent.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !webhookSecret) {
    console.error("stripe-webhook: missing STRIPE_SECRET_KEY/WEBHOOK_SECRET");
    return res.status(503).json({ error: "Webhook not configured." });
  }

  const stripe = new Stripe(key);

  let event;
  try {
    const raw = await readRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    // Bad signature or unreadable body — do NOT retry-storm; 400 tells Stripe.
    console.error("stripe-webhook signature verification failed", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      // Re-retrieve for the freshest metadata (idempotency flags may have been
      // written by the redirect/verify path between completion and this event).
      const session = await stripe.checkout.sessions.retrieve(
        event.data.object.id,
      );

      const paid =
        session.payment_status === "paid" || session.status === "complete";
      if (paid && process.env.RESEND_API_KEY) {
        const tier = tierFromSession(session);
        const gift = session.metadata?.gift === "1";

        if (gift) {
          // Backup for the recipient redemption email.
          const alreadySent = session.metadata?.gift_email_sent === "1";
          const custom = session.custom_fields || [];
          const field = custom.find((f) => f.key === "recipient_email");
          const recipient =
            field?.text?.value || session.metadata?.recipient_email || null;
          if (!alreadySent && recipient && String(recipient).includes("@")) {
            const ok = await sendGiftEmail({
              to: String(recipient).trim().toLowerCase(),
              tier,
              giftCode: session.id,
              fromName:
                session.metadata?.from_name ||
                session.customer_details?.name ||
                "Someone",
            });
            if (ok) {
              await stripe.checkout.sessions.update(session.id, {
                metadata: { gift_email_sent: "1" },
              });
            }
          }
        } else {
          // Non-gift: durably deliver the buyer their unlock code.
          const alreadySent = session.metadata?.buyer_email_sent === "1";
          const buyerEmail = session.customer_details?.email || null;
          if (!alreadySent && buyerEmail && String(buyerEmail).includes("@")) {
            const ok = await sendUnlockEmail({
              to: String(buyerEmail).trim().toLowerCase(),
              tier,
              code: session.id,
            });
            if (ok) {
              await stripe.checkout.sessions.update(session.id, {
                metadata: { buyer_email_sent: "1" },
              });
            }
          }
        }
      }
    }

    // Always acknowledge received events so Stripe stops retrying.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("stripe-webhook handler error", err);
    // 200 so Stripe does not retry a non-signature application error forever;
    // the failure is logged for manual follow-up.
    return res.status(200).json({ received: true, handled: false });
  }
}
