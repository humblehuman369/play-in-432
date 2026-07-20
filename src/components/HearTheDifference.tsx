import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, Pause, Play } from "lucide-react";
import {
  centsFromRatio,
  effectivePitchRatio,
  formatCents,
  impliedConcertA,
} from "../lib/retune";
import { formatHz } from "../lib/frequencies";
import type { RetuneStyle } from "../lib/types";

type DemoMode = "source" | "target";

type Props = {
  sourceA: number;
  targetA: number;
  retuneStyle: RetuneStyle;
};

/**
 * A/B pure-tone demo of the *effective* retune:
 * - Concert: A4 @ source vs A4 @ target
 * - Re-anchor: A4 @ source vs implied A4 after note re-anchor
 */
export function HearTheDifference({
  sourceA,
  targetA,
  retuneStyle,
}: Props) {
  const [mode, setMode] = useState<DemoMode>("source");
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const ratio = effectivePitchRatio(sourceA, targetA, retuneStyle);
  const cents = centsFromRatio(ratio);
  const afterA = impliedConcertA(sourceA, targetA, retuneStyle);
  const hz = mode === "source" ? sourceA : afterA;
  const same = Math.abs(ratio - 1) < 1e-6;

  const stop = useCallback(() => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {
        /* ignore */
      }
      oscRef.current = null;
    }
    setPlaying(false);
  }, []);

  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      const g = ctxRef.current.createGain();
      g.gain.value = 0.12;
      g.connect(ctxRef.current.destination);
      gainRef.current = g;
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const startTone = useCallback(
    async (freq: number) => {
      const ctx = await ensureCtx();
      stop();
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      if (gainRef.current) osc.connect(gainRef.current);
      osc.start();
      oscRef.current = osc;
      setPlaying(true);
    },
    [ensureCtx, stop],
  );

  useEffect(() => {
    if (oscRef.current && playing) {
      oscRef.current.frequency.setTargetAtTime(
        hz,
        ctxRef.current?.currentTime ?? 0,
        0.01,
      );
    }
  }, [hz, playing]);

  useEffect(() => {
    return () => {
      stop();
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, [stop]);

  const toggle = async () => {
    if (playing) stop();
    else await startTone(hz);
  };

  const selectMode = async (m: DemoMode) => {
    setMode(m);
    const f = m === "source" ? sourceA : afterA;
    if (playing) await startTone(f);
  };

  return (
    <section className="hear-diff card-block">
      <div className="hear-diff-title">
        <Ear size={16} />
        <h3>Hear the difference</h3>
      </div>
      <p className="hear-diff-lead">
        Pure A4 sine using the <strong>same ratio</strong> as music retune (
        {retuneStyle === "reanchor" ? "note re-anchor" : "concert A"}). No hype
        — your ears decide.
      </p>

      <div
        className="mode-toggle hear-diff-toggle"
        role="group"
        aria-label="Demo pitch"
      >
        <button
          type="button"
          className={mode === "source" ? "active" : ""}
          onClick={() => void selectMode("source")}
        >
          Source A={formatHz(sourceA)}
        </button>
        <button
          type="button"
          className={mode === "target" ? "active" : ""}
          onClick={() => void selectMode("target")}
          disabled={same}
        >
          After A≈{formatHz(afterA)}
        </button>
      </div>

      <div className="hear-diff-meta">
        <span>
          Now: <strong>{formatHz(hz)} Hz</strong> sine
        </span>
        <span>
          Ratio <code>{ratio.toFixed(6)}</code> · {formatCents(cents)}
        </span>
        {retuneStyle === "reanchor" && (
          <span className="muted-note">
            Label {formatHz(targetA)} Hz is the note target, not the new A4
          </span>
        )}
      </div>

      <button
        type="button"
        className="btn primary sm hear-diff-play"
        onClick={() => void toggle()}
      >
        {playing ? (
          <>
            <Pause size={14} /> Stop tone
          </>
        ) : (
          <>
            <Play size={14} /> Play pure tone
          </>
        )}
      </button>

      <p className="hear-diff-note">
        Headphones help. For an <em>exact</em> sine at the labeled Solfeggio Hz,
        use the TrueHz pure-tone bed — that is separate from whole-mix re-anchor.
      </p>
    </section>
  );
}
