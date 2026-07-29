/**
 * Phase 3 — Shareable "Hear the difference" demos.
 * Built-in synthesized clips (no user upload) for privacy-safe viral sharing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Pause, Play, Share2 } from "lucide-react";
import { BRAND } from "../lib/brand";

export type DemoClipId =
  | "piano"
  | "pad"
  | "guitar"
  | "strings"
  | "bells";

const CLIPS: {
  id: DemoClipId;
  title: string;
  genre: string;
  /** Relative amplitudes / frequencies for a short motif at A=440 reference */
  motif: { f: number; dur: number; gap?: number }[];
}[] = [
  {
    id: "piano",
    title: "Soft piano",
    genre: "Classical",
    motif: [
      { f: 261.63, dur: 0.35 },
      { f: 329.63, dur: 0.35 },
      { f: 392.0, dur: 0.45 },
      { f: 523.25, dur: 0.6 },
    ],
  },
  {
    id: "pad",
    title: "Ambient pad",
    genre: "Meditation",
    motif: [
      { f: 220, dur: 1.2 },
      { f: 277.18, dur: 1.2 },
      { f: 329.63, dur: 1.4 },
    ],
  },
  {
    id: "guitar",
    title: "Acoustic pluck",
    genre: "Acoustic",
    motif: [
      { f: 196, dur: 0.4 },
      { f: 246.94, dur: 0.4 },
      { f: 293.66, dur: 0.5 },
      { f: 392, dur: 0.7 },
    ],
  },
  {
    id: "strings",
    title: "String swell",
    genre: "Orchestral",
    motif: [
      { f: 293.66, dur: 0.8 },
      { f: 349.23, dur: 0.8 },
      { f: 440, dur: 1.0 },
    ],
  },
  {
    id: "bells",
    title: "Bell tones",
    genre: "Ambient",
    motif: [
      { f: 523.25, dur: 0.5 },
      { f: 659.25, dur: 0.5 },
      { f: 783.99, dur: 0.7 },
    ],
  },
];

const TARGETS = [432, 528, 444, 417] as const;

type Props = {
  /** When opened as a public share page */
  embedded?: boolean;
  initialClip?: DemoClipId;
  initialTarget?: number;
};

function buildShareUrl(clip: DemoClipId, target: number): string {
  const u = new URL(window.location.origin + window.location.pathname);
  u.searchParams.set("share", "1");
  u.searchParams.set("clip", clip);
  u.searchParams.set("hz", String(target));
  u.searchParams.set("utm_source", "share");
  u.searchParams.set("utm_medium", "demo");
  return u.toString();
}

export function ShareDemoView({
  embedded,
  initialClip = "piano",
  initialTarget = 432,
}: Props) {
  const [clipId, setClipId] = useState<DemoClipId>(initialClip);
  const [targetHz, setTargetHz] = useState(initialTarget);
  const [mode, setMode] = useState<"source" | "target">("source");
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const clip = useMemo(
    () => CLIPS.find((c) => c.id === clipId) || CLIPS[0],
    [clipId],
  );

  const stop = useCallback(() => {
    for (const n of nodesRef.current) {
      try {
        (n as OscillatorNode).stop?.();
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    nodesRef.current = [];
    setPlaying(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(async () => {
    stop();
    const ctx = ctxRef.current || new AudioContext();
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const ratio = mode === "target" ? targetHz / 440 : 1;
    let t = ctx.currentTime + 0.05;
    for (const note of clip.motif) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = clip.id === "pad" || clip.id === "strings" ? "sawtooth" : "sine";
      osc.frequency.value = note.f * ratio;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + note.dur + 0.02);
      nodesRef.current.push(osc, gain);
      t += note.dur + (note.gap ?? 0.05);
    }
    setPlaying(true);
    const ms = (t - ctx.currentTime) * 1000;
    window.setTimeout(() => setPlaying(false), ms);
  }, [clip, mode, targetHz, stop]);

  const shareUrl = buildShareUrl(clipId, targetHz);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy share link:", shareUrl);
    }
  };

  // Open Graph is set on document when embedded share page
  useEffect(() => {
    if (!embedded) return;
    document.title = `Hear ${targetHz} Hz — ${BRAND.product}`;
  }, [embedded, targetHz]);

  return (
    <div className={`share-demo ${embedded ? "share-demo-embed" : ""}`}>
      {!embedded && (
        <>
          <h2>Share “Hear the difference”</h2>
          <p className="share-lead">
            Send a free, no-account demo link. Recipients toggle original (A=440
            reference) vs your target — powered by {BRAND.techMark}.
          </p>
        </>
      )}

      {embedded && (
        <header className="share-embed-header">
          <p className="share-kicker">{BRAND.product}</p>
          <h1>Hear the difference</h1>
          <p>
            {clip.title} · {mode === "source" ? "Reference A=440" : `Target ${targetHz} Hz`}
          </p>
        </header>
      )}

      <div className="share-controls">
        <label>
          Clip
          <select
            value={clipId}
            onChange={(e) => setClipId(e.target.value as DemoClipId)}
          >
            {CLIPS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.genre})
              </option>
            ))}
          </select>
        </label>
        <label>
          Target Hz
          <select
            value={targetHz}
            onChange={(e) => setTargetHz(Number(e.target.value))}
          >
            {TARGETS.map((h) => (
              <option key={h} value={h}>
                {h} Hz
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="share-ab">
        <button
          type="button"
          className={`chip ${mode === "source" ? "on" : ""}`}
          onClick={() => setMode("source")}
        >
          Reference (A=440)
        </button>
        <button
          type="button"
          className={`chip ${mode === "target" ? "on" : ""}`}
          onClick={() => setMode("target")}
        >
          Target {targetHz} Hz
        </button>
      </div>

      <button type="button" className="btn primary" onClick={() => void play()}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
        {playing ? "Playing…" : "Play demo"}
      </button>

      <div className="share-link-row">
        <button type="button" className="btn sm" onClick={() => void copyLink()}>
          <Link2 size={14} /> {copied ? "Copied!" : "Copy share link"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            className="btn sm"
            onClick={() =>
              void navigator.share?.({
                title: `Hear ${targetHz} Hz — ${BRAND.product}`,
                text: "Hear the difference — free, no account.",
                url: shareUrl,
              })
            }
          >
            <Share2 size={14} /> Share…
          </button>
        )}
      </div>

      <p className="share-note">
        This plays a short built-in motif (not your library). Ratio math only —
        personal listening preference, not a medical claim.{" "}
        <a href="https://playin432.com/">{BRAND.product} →</a>
      </p>
    </div>
  );
}

export function parseShareParams(search: string): {
  isShare: boolean;
  clip: DemoClipId;
  hz: number;
} {
  const p = new URLSearchParams(search);
  const isShare = p.get("share") === "1" || p.has("clip");
  const clipRaw = (p.get("clip") || "piano") as DemoClipId;
  const clip = CLIPS.some((c) => c.id === clipRaw) ? clipRaw : "piano";
  const hz = Number(p.get("hz") || 432);
  return {
    isShare,
    clip,
    hz: Number.isFinite(hz) ? hz : 432,
  };
}
