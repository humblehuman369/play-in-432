import { useState } from "react";
import { Crown, Loader2, X } from "lucide-react";
import { FREE_HQ_EXPORT_LIMIT, PRO_PRICE_LABEL } from "../lib/pro";
import { BRAND } from "../lib/brand";

export type UpgradeReason = "frequency" | "export" | "general";

type Props = {
  open: boolean;
  reason: UpgradeReason;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onUpgrade: () => void;
  onRestoreAccess?: (input: {
    email?: string;
    sessionId?: string;
  }) => Promise<boolean>;
  nativeBilling?: boolean;
  onRestoreStore?: () => void;
};

const COPY: Record<UpgradeReason, { title: string; body: string }> = {
  frequency: {
    title: "This target is a Pro feature",
    body: "Free includes A=432 and A=440. TrueHz Pro unlocks every Solfeggio and custom concert reference — one-time, no subscription.",
  },
  export: {
    title: "HQ export limit reached",
    body: `Free includes ${FREE_HQ_EXPORT_LIMIT} TrueHz Convert HQ WAV downloads. Pro unlocks unlimited high-quality exports.`,
  },
  general: {
    title: "TrueHz Pro",
    body: `All frequency targets + unlimited ${BRAND.convertProduct} HQ export for ${PRO_PRICE_LABEL} once.`,
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
        <button
          type="button"
          className="btn primary lg"
          onClick={onUpgrade}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 size={18} className="spin" /> Opening checkout…
            </>
          ) : (
            <>
              <Crown size={18} /> Unlock Pro — {PRO_PRICE_LABEL}
            </>
          )}
        </button>

        <button
          type="button"
          className="link-btn"
          onClick={() => setShowRestore((v) => !v)}
          disabled={busy}
        >
          Already paid? Restore Pro
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
            />
            <input
              type="text"
              placeholder="Or cs_live_… session id"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={busy}
              className="upgrade-restore-input"
            />
            <button
              type="button"
              className="btn primary sm"
              onClick={() => void submitRestore()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" /> Restoring…
                </>
              ) : (
                "Restore Pro"
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
