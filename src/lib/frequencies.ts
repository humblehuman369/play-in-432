/**
 * One-tap frequency anchors + mood guide for Play In 432.
 * TrueHz honesty: these set the *concert reference* for ratio retune
 * (source A → target A). They are not medical claims, and mixed music
 * is never “pure X.00 Hz throughout.”
 */

export type FrequencyAnchor = {
  /** Target concert pitch (Hz) when used as retune target */
  hz: number;
  /** Short UI label */
  label: string;
  /** Marketing-style name (tradition / perception — not medical) */
  name: string;
  /** One-line honest note */
  note: string;
  /** Highlight primary product default */
  featured?: boolean;
  /** Treat as “no retune” / original when selected */
  isOriginal?: boolean;
};

/** Solfeggio-style + 432 / 440 anchors (HZP-comparable set, TrueHz framing). */
export const FREQUENCY_ANCHORS: FrequencyAnchor[] = [
  {
    hz: 440,
    label: "440",
    name: "Standard",
    note: "Common concert pitch — Original mode (no retune).",
    isOriginal: true,
  },
  {
    hz: 432,
    label: "432",
    name: "Nature’s Tone",
    note: "A=440 → A=432 whole-mix reference retune (~−31.8 ¢).",
    featured: true,
  },
  {
    hz: 444,
    label: "444",
    name: "Bright A",
    note: "Slightly sharp concert A relative to 440.",
  },
  {
    hz: 174,
    label: "174",
    name: "Foundation",
    note: "Reference retune only — not a pure 174 Hz mix claim.",
  },
  {
    hz: 285,
    label: "285",
    name: "Restoration",
    note: "Reference retune only — not a pure 285 Hz mix claim.",
  },
  {
    hz: 396,
    label: "396",
    name: "Liberation",
    note: "Reference retune only — not a pure 396 Hz mix claim.",
  },
  {
    hz: 417,
    label: "417",
    name: "Change",
    note: "Reference retune only — not a pure 417 Hz mix claim.",
  },
  {
    hz: 528,
    label: "528",
    name: "Transformation",
    note: "Whole-mix pitch to A=528 — not “DNA / pure 528 music.”",
  },
  {
    hz: 639,
    label: "639",
    name: "Connection",
    note: "Reference retune only — not a pure 639 Hz mix claim.",
  },
  {
    hz: 741,
    label: "741",
    name: "Awakening",
    note: "Re-anchor: F♯5 → 741 Hz (small shift). Concert A: large jump.",
  },
  {
    hz: 852,
    label: "852",
    name: "Intuition",
    note: "Re-anchor: G♯5 → 852 Hz (small shift). Concert A: ~octave up.",
  },
  {
    hz: 963,
    label: "963",
    name: "Oneness",
    note: "Re-anchor: B5 → 963 Hz (small shift). Concert A: large jump.",
  },
];

export type MoodGuide = {
  id: string;
  /** How you want to feel — preference, not prescription */
  mood: string;
  /** Target Hz for retune anchor */
  hz: number;
  blurb: string;
};

export const MOOD_GUIDES: MoodGuide[] = [
  {
    id: "everyday",
    mood: "Everyday, warmer",
    hz: 432,
    blurb: "Most popular A=432 reference retune.",
  },
  {
    id: "wind-down",
    mood: "Wind down",
    hz: 174,
    blurb: "Lower reference — try with sleep timer.",
  },
  {
    id: "let-go",
    mood: "Let go of stress",
    hz: 396,
    blurb: "Traditional association — your ears decide.",
  },
  {
    id: "fresh",
    mood: "A fresh start",
    hz: 417,
    blurb: "Mid Solfeggio-style anchor as reference only.",
  },
  {
    id: "uplift",
    mood: "Uplift",
    hz: 528,
    blurb: "Whole-mix A=528 retune — not medical claims.",
  },
  {
    id: "connect",
    mood: "Connection",
    hz: 639,
    blurb: "Preference mapping, not therapy.",
  },
  {
    id: "focus",
    mood: "Focus & clarity",
    hz: 741,
    blurb: "Try while working — switch anytime.",
  },
  {
    id: "calm",
    mood: "Intuition & calm",
    hz: 852,
    blurb: "Higher anchor; optional TrueHz bed for exact Hz.",
  },
];

export const SLEEP_TIMER_PRESETS_MIN = [5, 15, 30, 45, 60, 90] as const;

export function formatHz(hz: number): string {
  return Number.isInteger(hz) ? String(hz) : hz.toFixed(1);
}

export function findAnchor(hz: number): FrequencyAnchor | undefined {
  return FREQUENCY_ANCHORS.find((a) => Math.abs(a.hz - hz) < 0.5);
}

export function matchAnchorTarget(
  sourceA: number,
  targetA: number,
  mode: "original" | "retuned",
): FrequencyAnchor | undefined {
  if (mode === "original" || Math.abs(sourceA - targetA) < 0.01) {
    return FREQUENCY_ANCHORS.find((a) => a.isOriginal);
  }
  return findAnchor(targetA);
}
