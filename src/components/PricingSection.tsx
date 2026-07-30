import { useState } from "react";
import { Check, Crown, Gift, Loader2, Sparkles, X } from "lucide-react";
import {
  FREE_FEATURES,
  LITE_FEATURES,
  LITE_PRICE_LABEL,
  PRO_FEATURES,
  PRO_PRICE_LABEL,
  type TierId,
} from "../lib/pro";
import { BRAND } from "../lib/brand";

type Props = {
  tier: TierId;
  isPro: boolean;
  checkoutBusy?: boolean;
  checkoutError?: string | null;
  onUpgrade: (opts?: { tier?: "lite" | "pro"; gift?: boolean }) => void;
  onRestore?: () => void;
  onRestoreAccess?: (input: {
    email?: string;
    sessionId?: string;
    code?: string;
  }) => Promise<boolean>;
  nativeBilling?: boolean;
  compact?: boolean;
};

export function PricingSection({
  tier,
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
  const [restoreCode, setRestoreCode] = useState("");
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [giftTier, setGiftTier] = useState<"lite" | "pro">("pro");

  const submitRestore = async () => {
    setLocalMsg(null);
    if (!onRestoreAccess) {
      onRestore?.();
      return;
    }
    const email = restoreEmail.trim();
    const code = restoreCode.trim();
    if (!email && !code && nativeBilling && onRestore) {
      onRestore();
      return;
    }
    if (!email && !code) {
      setLocalMsg("Enter your Stripe receipt email or a gift/session code.");
      return;
    }
    const ok = await onRestoreAccess({
      email: email || undefined,
      sessionId: code || undefined,
      code: code || undefined,
    });
    if (ok) {
      setLocalMsg("Access restored on this device.");
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
          <h2 className="landing-h2">Free to listen. Upgrade when you need more.</h2>
          <p className="landing-section-lead">
            Keep the aha free forever — drop a track, hear{" "}
            <span className="gold-hz">432</span>. Unlock every target with Lite
            or unlimited {BRAND.convertProduct} with Pro. No account required.
          </p>
        </>
      )}

      <div className="pricing-grid pricing-grid-3">
        {/* Free */}
        <div className="pricing-card">
          <h3>Free forever</h3>
          <p className="pricing-price">
            $0 <span>always</span>
          </p>
          <ul className="pricing-features">
            {FREE_FEATURES.map((f) => (
              <li key={f}>
                <Check size={14} /> {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Lite */}
        <div className={`pricing-card ${tier === "lite" ? "is-current" : ""}`}>
          <div className="pricing-badge soft">Most popular step</div>
          <h3>TrueHz Lite</h3>
          <p className="pricing-price">
            {LITE_PRICE_LABEL} <span>one-time</span>
          </p>
          <ul className="pricing-features">
            {LITE_FEATURES.map((f) => (
              <li key={f}>
                <Check size={14} /> {f}
              </li>
            ))}
          </ul>
          {tier === "lite" || isPro ? (
            <p className="pricing-owned">
              <Sparkles size={14} /> {isPro ? "Included in Pro" : "Lite active"}
            </p>
          ) : (
            <button
              type="button"
              className="btn primary pricing-cta"
              disabled={checkoutBusy}
              onClick={() => onUpgrade({ tier: "lite" })}
            >
              {checkoutBusy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Unlock Lite — {LITE_PRICE_LABEL}
            </button>
          )}
        </div>

        {/* Pro */}
        <div
          className={`pricing-card pricing-card-pro ${isPro ? "is-current" : ""}`}
        >
          <div className="pricing-badge">Best value</div>
          <h3>
            <Crown size={18} /> TrueHz Pro
          </h3>
          <p className="pricing-price">
            {nativeBilling ? "$19.99" : PRO_PRICE_LABEL}{" "}
            <span>one-time{nativeBilling ? " · via App Store" : ""}</span>
          </p>
          <ul className="pricing-features">
            {PRO_FEATURES.map((f) => (
              <li key={f}>
                <Check size={14} /> {f}
              </li>
            ))}
          </ul>
          {isPro ? (
            <p className="pricing-owned">
              <Crown size={14} /> Pro active on this device
            </p>
          ) : (
            <button
              type="button"
              className="btn primary pricing-cta"
              disabled={checkoutBusy}
              onClick={() => onUpgrade({ tier: "pro" })}
            >
              {checkoutBusy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Crown size={16} />
              )}
              Unlock Pro — {nativeBilling ? "$19.99" : PRO_PRICE_LABEL}
            </button>
          )}
        </div>
      </div>

      {/* Gift */}
      <div className="pricing-gift-row">
        <Gift size={18} />
        <div className="pricing-gift-copy">
          <strong>Buy as a gift</strong>
          <p>
            Purchase Lite or Pro for someone else. You’ll get a redeem code to
            share — they activate it here with no account.
          </p>
        </div>
        <div className="pricing-gift-actions">
          <select
            value={giftTier}
            onChange={(e) => setGiftTier(e.target.value as "lite" | "pro")}
            aria-label="Gift tier"
          >
            <option value="lite">Lite {LITE_PRICE_LABEL}</option>
            <option value="pro">Pro {PRO_PRICE_LABEL}</option>
          </select>
          <button
            type="button"
            className="btn sm"
            disabled={checkoutBusy}
            onClick={() => onUpgrade({ tier: giftTier, gift: true })}
          >
            <Gift size={14} /> Buy gift
          </button>
        </div>
      </div>

      <div className="pricing-restore-row">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setShowRestore((v) => !v)}
        >
          Restore purchase / redeem gift
        </button>
        {nativeBilling && onRestore && (
          <button
            type="button"
            className="btn ghost sm"
            disabled={checkoutBusy}
            onClick={() => void onRestore()}
          >
            Restore App Store purchase
          </button>
        )}
      </div>

      {showRestore && (
        <div className="pricing-restore-panel">
          <p>
            Use the <strong>email</strong> from your Stripe receipt, or paste a{" "}
            <strong>gift / session code</strong> (starts with <code>cs_</code>).
          </p>
          <label>
            Email
            <input
              type="email"
              value={restoreEmail}
              onChange={(e) => setRestoreEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>
          <label>
            Gift / session code
            <input
              type="text"
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              placeholder="cs_live_… or gift code"
              autoComplete="off"
            />
          </label>
          <div className="pricing-restore-actions">
            <button
              type="button"
              className="btn primary sm"
              disabled={checkoutBusy}
              onClick={() => void submitRestore()}
            >
              {checkoutBusy ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Check size={14} />
              )}
              Restore on this device
            </button>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => setShowRestore(false)}
            >
              <X size={14} /> Cancel
            </button>
          </div>
          {localMsg && <p className="pricing-restore-msg">{localMsg}</p>}
        </div>
      )}

      {checkoutError && (
        <p className="pricing-error" role="alert">
          {checkoutError}
        </p>
      )}

      <p className="pricing-footnote">
        No Play In 432 account required. Web purchases unlock this browser;
        App Store purchases restore via Apple. Cross-device: use the same Stripe
        email or gift code on each device.
      </p>
    </section>
  );
}
