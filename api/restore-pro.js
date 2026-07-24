/**
 * Restore TrueHz Pro after reinstall / new browser / app origin change.
 *
 * Body:
 *   { sessionId: "cs_live_…" }  — from Stripe success URL / receipt
 *   { email: "you@example.com" } — email used at Stripe Checkout
 *
 * Env: STRIPE_SECRET_KEY
 */
import Stripe from "stripe";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isPaidSession(session) {
  if (!session) return false;
  const paid =
    session.payment_status === "paid" || session.status === "complete";
  if (!paid) return false;
  // Prefer our metadata; also accept $19 Pro amount
  if (session.metadata?.product === "truehz_pro") return true;
  if (session.metadata?.app === "play-in-432") return true;
  const amount = session.amount_total ?? 0;
  // $19.00 one-time (allow small variance for tax-inclusive locales)
  if (amount >= 1900 && amount <= 2500 && session.mode === "payment") {
    return true;
  }
  return false;
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

  // 1) Known Stripe customers with this email
  const customers = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers.data) {
    const sessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 30,
    });
    for (const s of sessions.data) {
      if (isPaidSession(s)) return s;
    }
  }

  // 2) Guest checkouts — scan recent complete sessions (bounded)
  // Stripe list is newest-first.
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
        return s;
      }
    }
    if (!list.has_more) break;
    starting_after = list.data[list.data.length - 1].id;
  }

  return null;
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
    const sessionId = (body.sessionId || body.session_id || "").trim();
    const email = (body.email || "").trim();

    if (!sessionId && !email) {
      return res.status(400).json({
        error: "Enter the email you used at checkout, or a Stripe session id (cs_…).",
      });
    }

    const stripe = new Stripe(key);
    let session = null;

    if (sessionId) {
      session = await findBySessionId(stripe, sessionId);
      if (!session) {
        return res.status(404).json({
          paid: false,
          error: "No paid TrueHz Pro session found for that id.",
        });
      }
    } else {
      session = await findByEmail(stripe, email);
      if (!session) {
        return res.status(404).json({
          paid: false,
          error:
            "No paid TrueHz Pro purchase found for that email. Use the same email as your Stripe receipt, or contact support.",
        });
      }
    }

    return res.status(200).json({
      paid: true,
      sessionId: session.id,
      email: emailOf(session),
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch (err) {
    console.error("restore-pro", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Restore failed",
    });
  }
}
