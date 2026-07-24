import { useState } from "react";
import { Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import {
  FREE_HQ_EXPORT_LIMIT,
  PRO_PRICE_LABEL,
  PRO_PRICE_USD,
} from "../lib/pro";
import { BRAND } from "../lib/brand";

type Props = {
  isPro: boolean;
  checkoutBusy?: boolean;
  checkoutError?: string | null;
  onUpgrade: () => void;
  /** App Store restore (optional) */
  onRestore?: () => void;
  /** Stripe email / session restore — preferred for card buyers */
  onRestoreAccess?: (input: {
    email?: string;
    sessionId?: string;
  }) => Promise<boolean>;
  /** Native app uses RevenueCat / StoreKit */
  nativeBilling?: boolean;
  compact?: boolean;
};

const FREE_FEATURES = [
  "Unlimited live retune · A=440 → A=432",
  "Library, playlists, Learn",
  "Spotify playlist match (metadata only)",
  `${FREE_HQ_EXPORT_LIMIT} TrueHz Convert HQ exports`,
  "TrueHz pure-tone bed",
] as const;

const PRO_FEATURES = [
  "Everything in Free",
  "All Solfeggio & custom targets",
  "Unlimited TrueHz Convert HQ WAV",
  "One-time unlock — no subscription",
  "Restore on any device with your purchase email",
] as const;

export function PricingSection({
  isPro,
  checkoutBusy,
  checkoutError,
  onUpgrade,
  onRestore,
  onRestoreAccess,
  nativeBilling,
  compact,
}: Props) {
  const [showRestore, setShowRestore] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreSession, setRestoreSession] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  const submitRestore = async () => {
    setLocalMsg(null);
    if (!onRestoreAccess) {
      onRestore?.();
      return;
    }
    const email = restoreEmail.trim();
    const sessionId = restoreSession.trim();
    if (!email && !sessionId && nativeBilling && onRestore) {
      onRestore();
      return;
    }
    if (!email && !sessionId) {
      setLocalMsg("Enter the email from your Stripe receipt.");
      return;
    }
    const ok = await onRestoreAccess({
      email: email || undefined,
      sessionId: sessionId || undefined,
    });
    if (ok) {
      setLocalMsg("TrueHz Pro restored on this device.");
      setShowRestore(false);
    }
  };

  return (
    <section
      className={`landing-section landing-pricing ${compact ? "compact" : ""}`}
      id="pricing"
    >
      {!compact && (
        <>
          <p className="landing-section-kicker">Pricing</p>
          <h2 className="landing-h2">Free to listen. Pro to go further.</h2>
          <p className="landing-section-lead">
            Keep the aha free forever — drop a track, hear{" "}
            <span className="gold-hz">432</span>. Unlock every target and
            unlimited {BRAND.convertProduct} when you’re ready.
          </p>
        </>
      )}

      {isPro ? (
        <div className="pricing-pro-active">
          <Crown size={20} />
          <div>
            <strong>TrueHz Pro is active on this device</strong>
            <p>All frequencies + unlimited HQ export. Thank you.</p>
          </div>
        </div>
      ) : (
        <div className="pricing-grid">
          <article className="pricing-card">
            <h3>Free forever</h3>
            <p className="pricing-price">
              $0 <span>always</span>
            </p>
            <ul>
              {FREE_FEATURES.map((f) => (
                <li key={f}>
                  <Check size={14} /> {f}
                </li>
              ))}
            </ul>
          </article>

          <article className="pricing-card pro">
            <div className="pricing-badge">
              <Sparkles size={12} /> Best value
            </div>
            <h3>TrueHz Pro</h3>
            <p className="pricing-price">
              {PRO_PRICE_LABEL}{" "}
              <span>one-time · ${PRO_PRICE_USD}</span>
            </p>
            <ul>
              {PRO_FEATURES.map((f) => (
                <li key={f}>
                  <Check size={14} /> {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn primary lg pricing-cta"
              onClick={onUpgrade}
              disabled={checkoutBusy}
            >
              {checkoutBusy ? (
                <>
                  <Loader2 size={18} className="spin" />{" "}
                  {nativeBilling ? "Purchasing…" : "Opening checkout…"}
                </>
              ) : (
                <>
                  <Crown size={18} /> Unlock Pro — {PRO_PRICE_LABEL}
                </>
              )}
            </button>

            <button
              type="button"
              className="btn ghost sm pricing-restore"
              onClick={() => {
                setShowRestore((v) => !v);
                setLocalMsg(null);
              }}
              disabled={checkoutBusy}
            >
              Already paid? Restore Pro
            </button>

            {showRestore && (
              <div className="pricing-restore-form">
                <p className="pricing-restore-lead">
                  There is no password login — Pro is unlocked on this device
                  when we verify your purchase. Use the{" "}
                  <strong>email on your Stripe receipt</strong>
                  {nativeBilling ? ", or restore App Store purchases" : ""}.
                </p>
                <label className="pricing-field">
                  <span>Receipt email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    disabled={checkoutBusy}
                  />
                </label>
                <label className="pricing-field">
                  <span>Or session id (optional)</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="cs_live_…"
                    value={restoreSession}
                    onChange={(e) => setRestoreSession(e.target.value)}
                    disabled={checkoutBusy}
                  />
                </label>
                <button
                  type="button"
                  className="btn primary sm"
                  onClick={() => void submitRestore()}
                  disabled={checkoutBusy}
                >
                  {checkoutBusy ? (
                    <>
                      <Loader2 size={16} className="spin" /> Restoring…
                    </>
                  ) : (
                    "Restore Pro"
                  )}
                </button>
                {nativeBilling && onRestore && (
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={onRestore}
                    disabled={checkoutBusy}
                  >
                    Restore App Store / Play
                  </button>
                )}
              </div>
            )}

            {(checkoutError || localMsg) && (
              <p
                className={`pricing-error ${localMsg && !checkoutError ? "ok" : ""}`}
                role="alert"
              >
                {checkoutError ? <X size={14} /> : null}{" "}
                {checkoutError || localMsg}
              </p>
            )}
            <p className="pricing-fine">
              No account or password. Pro stays on this device after restore.
              Keep your Stripe receipt email for new phones / reinstalls.
            </p>
          </article>
        </div>
      )}
    </section>
  );
}
