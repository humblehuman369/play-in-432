import { useState } from "react";
import { Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import {
  FREE_HQ_EXPORT_LIMIT,
  LITE_FEATURES,
  LITE_PRICE_LABEL,
  PRO_FEATURES,
  PRO_PRICE_LABEL,
} from "../lib/pro";
import { BRAND } from "../lib/brand";

export type UpgradeReason = "frequency" | "export" | "general";

type Props = {
  open: boolean;
  reason: UpgradeReason;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Start checkout for the chosen tier. */
  onUpgrade: (tier: "lite" | "pro") => void;
  onRestoreAccess?: (input: {
    email?: string;
    sessionId?: string;
  }) => Promise<boolean>;
  nativeBilling?: boolean;
  onRestoreStore?: () => void;
};

const COPY: Record<UpgradeReason, { title: string; body: string }> = {
  frequency: {
    title: "This target needs Lite or Pro",
    body: "Free includes A=432 and A=440. Unlock every Solfeggio and custom concert reference — one-time, no subscription.",
  },
  export: {
    title: "HQ export limit reached",
    body: `Free includes ${FREE_HQ_EXPORT_LIMIT} TrueHz Convert HQ downloads (WAV or MP3). Lite adds a monthly allowance; Pro is unlimited.`,
  },
  general: {
    title: "Unlock TrueHz",
    body: `All frequency targets + more ${BRAND.convertProduct} HQ export. One-time, no subscription.`,
  },
};

export function UpgradeModal({
  open,
  reason,
  busy,
  error,
  onClose,
  onUpgrade,
  onRestoreAccess,
  nativeBilling,
  onRestoreStore,
}: Props) {
  const [showRestore, setShowRestore] = useState(false);
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState("");

  if (!open) return null;
  const c = COPY[reason];

  const submitRestore = async () => {
    if (!onRestoreAccess) return;
    const ok = await onRestoreAccess({
      email: email.trim() || undefined,
      sessionId: sessionId.trim() || undefined,
    });
    if (ok) onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal upgrade-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="upgrade-modal-icon">
          <Crown size={22} />
        </div>
        <h2 id="upgrade-title">{c.title}</h2>
        <p>{c.body}</p>

        <div className="upgrade-cards" role="group" aria-label="Choose a plan">
          {/* Lite */}
          <div className="upgrade-card">
            <h3>TrueHz Lite</h3>
            <p className="upgrade-card-price">
              {LITE_PRICE_LABEL} <span>one-time</span>
            </p>
            <ul className="upgrade-card-features">
              {LITE_FEATURES.map((f) => (
                <li key={f}>
                  <Check size={13} aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn ghost"
              onClick={() => onUpgrade("lite")}
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={16} className="spin" aria-hidden />
              ) : (
                <Sparkles size={16} aria-hidden />
              )}
              Unlock Lite — {LITE_PRICE_LABEL}
            </button>
          </div>

          {/* Pro — pre-highlighted */}
          <div className="upgrade-card upgrade-card-pro" aria-label="Best value">
            <div className="upgrade-card-badge">Best value</div>
            <h3>
              <Crown size={16} aria-hidden /> TrueHz Pro
            </h3>
            <p className="upgrade-card-price">
              {nativeBilling ? "$19.99" : PRO_PRICE_LABEL} <span>one-time</span>
            </p>
            <ul className="upgrade-card-features">
              {PRO_FEATURES.map((f) => (
                <li key={f}>
                  <Check size={13} aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn primary"
              onClick={() => onUpgrade("pro")}
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={16} className="spin" aria-hidden />
              ) : (
                <Crown size={16} aria-hidden />
              )}
              Unlock Pro — {nativeBilling ? "$19.99" : PRO_PRICE_LABEL}
            </button>
          </div>
        </div>

        <button
          type="button"
          className="link-btn"
          onClick={() => setShowRestore((v) => !v)}
          disabled={busy}
        >
          Already paid? Restore access
        </button>

        {showRestore && (
          <div className="upgrade-restore">
            <p className="upgrade-restore-lead">
              No login password — enter the email from your Stripe receipt.
            </p>
            <input
              type="email"
              placeholder="Receipt email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="upgrade-restore-input"
              aria-label="Receipt email"
            />
            <input
              type="text"
              placeholder="Or cs_live_… unlock code"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={busy}
              className="upgrade-restore-input"
              aria-label="Unlock code"
            />
            <button
              type="button"
              className="btn primary sm"
              onClick={() => void submitRestore()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" aria-hidden /> Restoring…
                </>
              ) : (
                "Restore access"
              )}
            </button>
            {nativeBilling && onRestoreStore && (
              <button
                type="button"
                className="btn ghost sm"
                onClick={onRestoreStore}
                disabled={busy}
              >
                Restore App Store purchase
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="pricing-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="link-btn" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
