/** Concert-pitch + Solfeggio re-anchor retune math (TrueHz). */

export const DEFAULT_SOURCE_A = 440;
export const DEFAULT_TARGET_A = 432;

/** @deprecated Use pitchRatio(source, target) — kept for display defaults */
export const PITCH_RATIO_432 = DEFAULT_TARGET_A / DEFAULT_SOURCE_A;

/** @deprecated Use centsBetween(source, target) */
export const CENTS_432 = 1200 * Math.log2(PITCH_RATIO_432);

export const SOURCE_A = DEFAULT_SOURCE_A;
export const TARGET_A = DEFAULT_TARGET_A;

/**
 * How the target Hz is interpreted for pitch-shift ratio.
 * - concert: whole mix × (targetA / sourceA) — classic A→A retune
 * - reanchor: treat target as a named note (e.g. 852 = G♯5); shift only
 *   enough so that note lands on the labeled Hz (HZP-style, small moves)
 */
export type RetuneStyle = "concert" | "reanchor";

/** Clamp concert pitch to a sensible musical range. */
export function clampPitchA(hz: number): number {
  if (!Number.isFinite(hz)) return DEFAULT_SOURCE_A;
  return Math.min(2000, Math.max(100, hz));
}

/** Frequency scale: targetA / sourceA (concert-A style). */
export function pitchRatio(sourceA: number, targetA: number): number {
  const s = clampPitchA(sourceA);
  const t = clampPitchA(targetA);
  if (s === 0) return 1;
  return t / s;
}

/** Cents: 1200 · log2(ratio) */
export function centsBetween(sourceA: number, targetA: number): number {
  const r = pitchRatio(sourceA, targetA);
  if (r <= 0) return 0;
  return 1200 * Math.log2(r);
}

export function centsFromRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return 1200 * Math.log2(ratio);
}

/**
 * Equal-tempered note frequency when A4 = concertA.
 * semitonesFromA4: e.g. 0 = A4, −1 = G♯4/A♭4, +3 = C5.
 */
export function noteHzAtConcertA(
  concertA: number,
  semitonesFromA4: number,
): number {
  const a = clampPitchA(concertA);
  return a * 2 ** (semitonesFromA4 / 12);
}

/**
 * Solfeggio / anchor note map (HZP-style labels).
 * Key ≈ target Hz; value = ET note relative to A4.
 */
export const REANCHOR_NOTE_MAP: {
  hz: number;
  note: string;
  /** Semitones from A4 in 12-TET */
  semitonesFromA4: number;
}[] = [
  { hz: 174, note: "F3", semitonesFromA4: -16 },
  { hz: 285, note: "C♯4", semitonesFromA4: -8 },
  { hz: 396, note: "G4", semitonesFromA4: -2 },
  { hz: 417, note: "G♯4", semitonesFromA4: -1 },
  { hz: 432, note: "A4", semitonesFromA4: 0 },
  { hz: 440, note: "A4", semitonesFromA4: 0 },
  { hz: 444, note: "A4", semitonesFromA4: 0 },
  { hz: 528, note: "C5", semitonesFromA4: 3 },
  { hz: 639, note: "D♯5", semitonesFromA4: 6 },
  { hz: 741, note: "F♯5", semitonesFromA4: 9 },
  { hz: 852, note: "G♯5", semitonesFromA4: 11 },
  { hz: 963, note: "B5", semitonesFromA4: 14 },
];

export function findReanchorNote(targetHz: number) {
  return REANCHOR_NOTE_MAP.find((n) => Math.abs(n.hz - targetHz) < 0.6);
}

/**
 * Re-anchor ratio: labeledHz / (that note at source concert A).
 * Falls back to concert pitchRatio if no note map entry.
 */
export function reanchorPitchRatio(
  sourceA: number,
  labeledHz: number,
): { ratio: number; note: string | null; standardNoteHz: number | null; usedFallback: boolean } {
  const entry = findReanchorNote(labeledHz);
  if (!entry) {
    return {
      ratio: pitchRatio(sourceA, labeledHz),
      note: null,
      standardNoteHz: null,
      usedFallback: true,
    };
  }
  const standardNoteHz = noteHzAtConcertA(sourceA, entry.semitonesFromA4);
  if (standardNoteHz <= 0) {
    return {
      ratio: 1,
      note: entry.note,
      standardNoteHz,
      usedFallback: true,
    };
  }
  return {
    ratio: labeledHz / standardNoteHz,
    note: entry.note,
    standardNoteHz,
    usedFallback: false,
  };
}

/** Effective pitch scale for live play / HQ export. */
export function effectivePitchRatio(
  sourceA: number,
  targetA: number,
  style: RetuneStyle,
): number {
  if (style === "reanchor") {
    return reanchorPitchRatio(sourceA, targetA).ratio;
  }
  return pitchRatio(sourceA, targetA);
}

/** Implied A4 after applying the ratio (for UI honesty). */
export function impliedConcertA(
  sourceA: number,
  targetA: number,
  style: RetuneStyle,
): number {
  return clampPitchA(sourceA) * effectivePitchRatio(sourceA, targetA, style);
}

export function formatCents(cents: number): string {
  const sign = cents > 0 ? "+" : "";
  return `${sign}${cents.toFixed(1)} ¢`;
}

export function formatRatio(ratio: number): string {
  return ratio.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type PitchPreset = {
  id: string;
  label: string;
  sourceA: number;
  targetA: number;
};

export const PITCH_PRESETS: PitchPreset[] = [
  { id: "432", label: "440 → 432", sourceA: 440, targetA: 432 },
  { id: "444", label: "440 → 444", sourceA: 440, targetA: 444 },
  { id: "528", label: "440 → 528*", sourceA: 440, targetA: 528 },
  { id: "back", label: "432 → 440", sourceA: 432, targetA: 440 },
];

export const ACCEPTED_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/flac",
  "audio/ogg",
  "audio/webm",
];

export const ACCEPTED_EXT = /\.(mp3|wav|m4a|aac|flac|ogg|webm)$/i;

export function isAcceptedAudioFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  // Reject photos/videos from iPad "Take Photo" / library pickers (crash risk + wrong media)
  if (
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type === "public.image" ||
    type === "public.movie"
  ) {
    return false;
  }
  if (type && ACCEPTED_MIME.includes(type)) return true;
  // Some WebViews leave type empty — fall back to extension
  if (ACCEPTED_EXT.test(file.name || "")) return true;
  // HEIC / camera dumps often lack a useful extension
  if (/\.(heic|heif|jpg|jpeg|png|gif|webp|bmp|tiff?|mov|mp4|m4v)$/i.test(file.name || "")) {
    return false;
  }
  return false;
}

/** Safe download filename stem from track name. */
export function safeFileStem(name: string): string {
  return (
    name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^\w\s\-().]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "track"
  );
}
