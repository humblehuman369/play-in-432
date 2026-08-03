/**
 * Restore TrueHz Lite/Pro after reinstall / new browser / gift redeem.
 *
 * Body:
 *   { sessionId: "cs_live_…" }  — Stripe session or gift code
 *   { email: "you@example.com" } — email used at Stripe Checkout
 *
 * Env: STRIPE_SECRET_KEY
 */
import Stripe from "stripe";
import { setCors } from "./_lib/cors.js";

function tierFromSession(session) {
  const meta = session.metadata || {};
  if (meta.tier === "lite" || meta.product === "truehz_lite") return "lite";
  if (meta.tier === "pro" || meta.product === "truehz_pro") return "pro";
  const amount = session.amount_total ?? 0;
  if (amount > 0 && amount < 1500) return "lite";
  if (amount >= 1900 && amount <= 3500) return "pro";
  // Accept known product metadata app tag
  if (meta.app === "play-in-432") return "pro";
  return null;
}

function isPaidSession(session) {
  if (!session) return false;
  const paid =
    session.payment_status === "paid" || session.status === "complete";
  if (!paid) return false;
  return tierFromSession(session) != null;
}

function emailOf(session) {
  return (
    session.customer_details?.email ||
    session.customer_email ||
    session.customer_details?.customer_email ||
    null
  );
}

async function findBySessionId(stripe, sessionId) {
  if (!sessionId.startsWith("cs_")) return null;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return isPaidSession(session) ? session : null;
}

async function findByEmail(stripe, rawEmail) {
  const email = String(rawEmail || "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) return null;

  let best = null;
  let bestRank = -1;
  const rank = (t) => (t === "pro" ? 2 : t === "lite" ? 1 : 0);

  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 30,
    });
    for (const s of sessions.data) {
      if (!isPaidSession(s)) continue;
      const t = tierFromSession(s);
      const r = rank(t);
      if (r > bestRank) {
        best = s;
        bestRank = r;
      }
    }
  }

  let starting_after;
  for (let page = 0; page < 5; page++) {
    const list = await stripe.checkout.sessions.list({
      limit: 100,
      status: "complete",
      ...(starting_after ? { starting_after } : {}),
    });
    if (!list.data.length) break;
    for (const s of list.data) {
      const em = emailOf(s);
      if (em && em.toLowerCase() === email && isPaidSession(s)) {
        const t = tierFromSession(s);
        const r = rank(t);
        if (r > bestRank) {
          best = s;
          bestRank = r;
        }
      }
    }
    if (!list.has_more) break;
    starting_after = list.data[list.data.length - 1].id;
  }

  return best;
}

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
    const sessionId = (body.sessionId || body.session_id || body.code || "").trim();
    const email = (body.email || "").trim();

    if (!sessionId && !email) {
      return res.status(400).json({
        error:
          "Enter the email you used at checkout, or a gift/session code (cs_…).",
      });
    }

    const stripe = new Stripe(key);
    let session = null;

    if (sessionId) {
      session = await findBySessionId(stripe, sessionId);
      if (!session) {
        return res.status(404).json({
          paid: false,
          error: "No paid Lite/Pro session found for that code.",
        });
      }
    } else {
      session = await findByEmail(stripe, email);
      if (!session) {
        return res.status(404).json({
          paid: false,
          error:
            "No paid purchase found for that email. Use the same email as your Stripe receipt.",
        });
      }
    }

    const tier = tierFromSession(session) || "pro";

    return res.status(200).json({
      paid: true,
      sessionId: session.id,
      tier,
      email: emailOf(session),
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (err) {
    console.error("restore-pro", err);
    return res
      .status(500)
      .json({ error: "Something went wrong. Please try again." });
  }
}
