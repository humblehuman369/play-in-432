/**
 * Shared transactional email (Resend) for the checkout API handlers.
 *
 * - sendGiftEmail:   redemption instructions to a gift recipient.
 * - sendUnlockEmail: unlock/license code to the buyer, so they can restore
 *                    on any device even if they never saw the success page.
 *
 * All interpolated values are HTML-escaped. Both senders return false (never
 * throw) when RESEND_API_KEY is unset or the provider rejects the send.
 *
 * Env: RESEND_API_KEY (required to send), GIFT_FROM_EMAIL (optional sender).
 */

/** HTML-escape untrusted text before interpolating into email markup. */
export function esc(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fromAddress() {
  return (
    process.env.GIFT_FROM_EMAIL?.trim() ||
    "Play In 432 <onboarding@resend.dev>"
  );
}

async function resendSend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress(), to: [to], subject, html }),
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    console.error("resend", r.status, errText);
    return false;
  }
  return true;
}

/** Redemption email to a gift recipient. */
export async function sendGiftEmail({ to, tier, giftCode, fromName }) {
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
      <p style="font-size:13px;color:#445">Unlock code:</p>
      <code style="display:block;padding:10px;background:#f0f4f3;border-radius:8px;word-break:break-all">${safeCode}</code>
      <p style="font-size:13px;color:#445;margin-top:24px">
        Or visit <a href="https://playin432.com/">playin432.com</a> → Pricing → Restore purchase / redeem gift.
      </p>
    </div>
  `;

  return resendSend({
    to,
    subject: `Your Play In 432 gift — ${tierLabel}`,
    html,
  });
}

/**
 * Unlock/license email to the buyer of a (non-gift) purchase. The code is
 * the Stripe session id; pasting it (or the buyer's checkout email) into
 * Restore re-activates the tier on any device.
 */
export async function sendUnlockEmail({ to, tier, code }) {
  const tierLabel = tier === "lite" ? "TrueHz Lite" : "TrueHz Pro";
  const safeCode = esc(code);
  const restoreUrl = "https://playin432.com/?redeem=" + encodeURIComponent(code);
  const safeRestoreUrl = esc(restoreUrl);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0a1218">
      <h1 style="font-size:20px">You're unlocked — ${esc(tierLabel)}</h1>
      <p>Thanks for buying <strong>Play In 432</strong>. This is your unlock code — it's your license. <strong>Save this email</strong> to restore ${esc(
        tierLabel,
      )} on any device.</p>
      <p style="font-size:13px;color:#445">Unlock code:</p>
      <code style="display:block;padding:10px;background:#f0f4f3;border-radius:8px;word-break:break-all">${safeCode}</code>
      <p style="margin:24px 0">
        <a href="${safeRestoreUrl}"
           style="background:#00d4aa;color:#072018;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">
          Restore on a device
        </a>
      </p>
      <p style="font-size:13px;color:#445;margin-top:24px">
        You can also restore at <a href="https://playin432.com/">playin432.com</a> → Pricing →
        Restore purchase, using this code or the email you paid with.
      </p>
    </div>
  `;

  return resendSend({
    to,
    subject: `Your Play In 432 unlock code — ${tierLabel}`,
    html,
  });
}
