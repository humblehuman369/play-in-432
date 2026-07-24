import { Lock } from "lucide-react";
import {
  FREQUENCY_ANCHORS,
  formatHz,
  matchAnchorTarget,
  type FrequencyAnchor,
} from "../lib/frequencies";
import {
  centsFromRatio,
  effectivePitchRatio,
  findReanchorNote,
  formatCents,
  impliedConcertA,
  reanchorPitchRatio,
} from "../lib/retune";
import { canUseTargetHz } from "../lib/pro";
import type { PlayMode, RetuneStyle } from "../lib/types";

type Props = {
  sourceA: number;
  targetA: number;
  mode: PlayMode;
  retuneStyle: RetuneStyle;
  onSelect: (anchor: FrequencyAnchor) => void;
  onRetuneStyleChange: (style: RetuneStyle) => void;
  /** Open Learn article “How far should you retune?” */
  onOpenHowFarLearn?: () => void;
  /** Open Learn article on re-anchor */
  onOpenReanchorLearn?: () => void;
  /** When true, Pro-only chips show a lock (still clickable → upgrade) */
  showProLocks?: boolean;
};

export function FrequencyStrip({
  sourceA,
  targetA,
  mode,
  retuneStyle,
  onSelect,
  onRetuneStyleChange,
  onOpenHowFarLearn,
  onOpenReanchorLearn,
  showProLocks = true,
}: Props) {
  const active = matchAnchorTarget(sourceA, targetA, mode);
  const ratio =
    mode === "retuned"
      ? effectivePitchRatio(sourceA, targetA, retuneStyle)
      : 1;
  const cents = centsFromRatio(ratio);
  const impliedA = impliedConcertA(sourceA, targetA, retuneStyle);
  const re = reanchorPitchRatio(sourceA, targetA);
  const note = findReanchorNote(targetA);

  return (
    <div className="freq-strip-wrap">
      <div className="freq-strip-head">
        <h3>Frequency</h3>
        <p>
          One tap · mid-song OK ·{" "}
          <strong>
            {mode === "original"
              ? "Original (no retune)"
              : retuneStyle === "reanchor"
                ? `Re-anchor ${formatHz(targetA)} Hz${note ? ` (${note.note})` : ""} · ${formatCents(cents)} · A≈${formatHz(impliedA)}`
                : `A=${formatHz(sourceA)} → A=${formatHz(targetA)} · ${formatCents(cents)}`}
          </strong>
        </p>
      </div>

      <div
        className="mode-toggle retune-style-toggle"
        role="group"
        aria-label="Retune style"
      >
        <button
          type="button"
          className={retuneStyle === "reanchor" ? "active" : ""}
          onClick={() => onRetuneStyleChange("reanchor")}
          title="Solfeggio note re-anchor — small, listenable shifts (HZP-style)"
        >
          Re-anchor
        </button>
        <button
          type="button"
          className={retuneStyle === "concert" ? "active" : ""}
          onClick={() => onRetuneStyleChange("concert")}
          title="Classic concert-A ratio: target ÷ source (large jumps for high Hz)"
        >
          Concert A
        </button>
      </div>

      <div
        className="freq-strip"
        role="listbox"
        aria-label="Target frequency anchors"
      >
        {FREQUENCY_ANCHORS.map((a) => {
          const on = active?.hz === a.hz;
          const mapped = findReanchorNote(a.hz);
          const locked = showProLocks && !canUseTargetHz(a.hz);
          return (
            <button
              key={a.hz}
              type="button"
              role="option"
              aria-selected={on}
              className={`freq-chip ${on ? "on" : ""} ${a.featured ? "featured" : ""} ${locked ? "locked" : ""}`}
              onClick={() => onSelect(a)}
              title={
                locked
                  ? `${a.name} — TrueHz Pro`
                  : mapped
                    ? `${a.name} · ${mapped.note} @ ${a.hz} Hz — ${a.note}`
                    : `${a.name} — ${a.note}`
              }
            >
              {mapped && !a.isOriginal ? (
                <span className="freq-chip-note">{mapped.note}</span>
              ) : (
                <span className="freq-chip-note freq-chip-note-spacer" aria-hidden>
                  ·
                </span>
              )}
              <span className="freq-chip-hz">
                {a.label}
                {locked && <Lock size={10} className="freq-lock" aria-hidden />}
              </span>
              <span className="freq-chip-name">{a.name}</span>
            </button>
          );
        })}
      </div>

      {mode === "retuned" && retuneStyle === "reanchor" && (
        <p className="freq-strip-note">
          {re.note
            ? `Note re-anchor: ${re.note} at A=${formatHz(sourceA)} is ~${re.standardNoteHz?.toFixed(1)} Hz → shift to ${formatHz(targetA)} Hz (${formatCents(cents)}). Implied A4 ≈ ${formatHz(impliedA)} Hz — not a full “A = ${formatHz(targetA)}” transposition.`
            : `No note map for ${formatHz(targetA)} Hz — using concert ratio as fallback.`}
        </p>
      )}
      {mode === "retuned" && retuneStyle === "concert" && active && !active.isOriginal && (
        <p className="freq-strip-note">{active.note}</p>
      )}

      <p className="freq-strip-tip">
        {retuneStyle === "reanchor" ? (
          <>
            Re-anchor keeps music balanced on high Solfeggio labels (741 / 852 /
            963). Concert A uses full target÷source (big jumps).
            {onOpenReanchorLearn ? (
              <>
                {" "}
                <button
                  type="button"
                  className="text-link freq-strip-tip-link"
                  onClick={onOpenReanchorLearn}
                >
                  How re-anchor works
                </button>
              </>
            ) : null}
          </>
        ) : (
          <>
            Tip: closer targets usually sound cleaner — large Hz jumps stress
            the mix more.
            {onOpenHowFarLearn ? (
              <>
                {" "}
                <button
                  type="button"
                  className="text-link freq-strip-tip-link"
                  onClick={onOpenHowFarLearn}
                >
                  How far should you retune?
                </button>
              </>
            ) : null}
          </>
        )}
      </p>
      <p className="freq-strip-disclaimer">
        TrueHz pure-tone bed still uses the <em>labeled</em> Hz as an exact sine
        when enabled. Mixed tracks are never “pure {formatHz(targetA)} Hz
        throughout.”
      </p>
    </div>
  );
}
