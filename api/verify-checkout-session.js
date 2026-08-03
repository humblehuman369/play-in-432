/**
 * Vercel Serverless — verify Stripe Checkout Session paid → client activates tier.
 *
 * Also sends the gift redemption email (folded in from the former
 * api/send-gift-email.js relay, which is removed) so there is no
 * unauthenticated public email endpoint. The gift email is sent at most
 * once per session, guarded by a `gift_email_sent` flag written back to the
 * Stripe session metadata.
 *
 * Env: STRIPE_SECRET_KEY (required)
 *      RESEND_API_KEY (optional — gift email only sent when present)
 *      GIFT_FROM_EMAIL (optional sender, e.g. gifts@playin432.com)
 *      APP_URL (optional production origin override)
 */
import Stripe from "stripe";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/** HTML-escape untrusted text before interpolating into email markup. */
function esc(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tier is authoritative from session metadata (set when we create the
 * session). No amount-total sniffing — coupons/proration must never
 * downgrade a tier. If metadata is somehow absent, default to "pro" and
 * warn (should not happen for sessions we create).
 */
function tierFromSession(session) {
  const meta = session.metadata || {};
  if (meta.tier === "lite" || meta.product === "truehz_lite") return "lite";
  if (meta.tier === "pro" || meta.product === "truehz_pro") return "pro";
  console.warn(
    "tierFromSession: no tier/product metadata on session",
    session.id,
  );
  return "pro";
}

/** Send the gift redemption email via Resend. Returns true on success. */
async function sendGiftEmail({ to, tier, giftCode, fromName }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const from =
    process.env.GIFT_FROM_EMAIL?.trim() ||
    "Play In 432 <onboarding@resend.dev>";
  const tierLabel = tier === "lite" ? "TrueHz Lite" : "TrueHz Pro";
  const safeName = esc(String(fromName || "Someone").trim().slice(0, 80));
  const safeCode = esc(giftCode);
  const redeemUrl = `https://playin432.com/?redeem=${encodeURIComponent(
    giftCode,
  )}`;
  const safeRedeemUrl = esc(redeemUrl);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0a1218">
      <h1 style="font-size:20px">You've received ${esc(tierLabel)}</h1>
      <p>${safeName} sent you a gift for <strong>Play In 432</strong> — retune your music with TrueHz™.</p>
      <p><strong>No account required.</strong> Open the link below (or paste the code in the app under Restore purchase / redeem gift):</p>
      <p style="margin:24px 0">
        <a href="${safeRedeemUrl}"
           style="background:#00d4aa;color:#072018;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">
          Redeem ${esc(tierLabel)}
        </a>
      </p>
      <p style="font-size:13px;color:#445">Gift code:</p>
      <code style="display:block;padding:10px;background:#f0f4f3;border-radius:8px;word-break:break-all">${safeCode}</code>
      <p style="font-size:13px;color:#445;margin-top:24px">
        Or visit <a href="https://playin432.com/">playin432.com</a> → Pricing → Restore purchase / redeem gift.
      </p>
    </div>
  `;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your Play In 432 gift — ${tierLabel}`,
      html,
    }),
  });

  if (!r.ok) {
    const errText = await r.text();
    console.error("resend", r.status, errText);
    return false;
  }
  return true;
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
      emailed: emailed || alreadySent,
    });
  } catch (err) {
    console.error("verify-checkout-session", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
