/**
 * Send gift redeem instructions via Resend (optional).
 * Env: RESEND_API_KEY, GIFT_FROM_EMAIL (e.g. gifts@playin432.com)
 *
 * Body: {
 *   to: string,           // recipient email
 *   tier: "lite"|"pro",
 *   giftCode: string,     // cs_… session id
 *   fromName?: string     // gifter display name (optional)
 * }
 */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.GIFT_FROM_EMAIL?.trim() || "Play In 432 <onboarding@resend.dev>";

  if (!apiKey) {
    return res.status(503).json({
      error:
        "Email is not configured. Add RESEND_API_KEY (and optional GIFT_FROM_EMAIL) in Vercel.",
      emailed: false,
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const to = String(body.to || "")
      .trim()
      .toLowerCase();
    const giftCode = String(body.giftCode || body.sessionId || "").trim();
    const tier = body.tier === "lite" ? "lite" : "pro";
    const fromName = String(body.fromName || "Someone").trim().slice(0, 80);

    if (!to.includes("@") || !giftCode.startsWith("cs_")) {
      return res.status(400).json({
        error: "Valid recipient email and gift code (cs_…) required.",
      });
    }

    const tierLabel = tier === "lite" ? "TrueHz Lite" : "TrueHz Pro";
    const redeemUrl = `https://playin432.com/?redeem=${encodeURIComponent(giftCode)}`;

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0a1218">
        <h1 style="font-size:20px">You've received ${tierLabel}</h1>
        <p>${fromName} sent you a gift for <strong>Play In 432</strong> — retune your music with TrueHz™.</p>
        <p><strong>No account required.</strong> Open the link below (or paste the code in the app under Restore purchase / redeem gift):</p>
        <p style="margin:24px 0">
          <a href="${redeemUrl}"
             style="background:#00d4aa;color:#072018;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600">
            Redeem ${tierLabel}
          </a>
        </p>
        <p style="font-size:13px;color:#445">Gift code:</p>
        <code style="display:block;padding:10px;background:#f0f4f3;border-radius:8px;word-break:break-all">${giftCode}</code>
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
      return res.status(502).json({
        emailed: false,
        error: `Email provider error (${r.status})`,
      });
    }

    const data = await r.json();
    return res.status(200).json({ emailed: true, id: data.id, redeemUrl });
  } catch (err) {
    console.error("send-gift-email", err);
    return res.status(500).json({
      emailed: false,
      error: err instanceof Error ? err.message : "Email failed",
    });
  }
}
