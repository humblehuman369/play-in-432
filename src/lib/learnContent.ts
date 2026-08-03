/**
 * Play In 432 · Learn / Science
 * Honest TrueHz framing — no miracle claims, no conspiracy marketing.
 */

export type LearnSection =
  | { type: "p"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "callout"; tone: "info" | "warn" | "tech"; title: string; text: string }
  | { type: "formula"; label: string; value: string };

export type LearnArticle = {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  category: "Basics" | "TrueHz" | "Quality" | "Verify" | "Research";
  sections: LearnSection[];
};

export const LEARN_INTRO = {
  title: "Learn",
  subtitle:
    "What retuning actually is — and what we will never claim. Powered by TrueHz™ technology.",
};

/** 440 → 432 reference numbers used in copy */
export const LEARN_RATIO = "432 ÷ 440 = 0.981818…";
export const LEARN_CENTS = "≈ −31.8 ¢";

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    id: "what-is-retune",
    title: "What A=440 → A=432 actually is",
    summary:
      "Concert pitch, the pitch ratio, cents, and why tempo stays the same.",
    minutes: 3,
    category: "Basics",
    sections: [
      {
        type: "p",
        text: "Most commercial music is mixed and mastered as if the note A above middle C is 440 Hz (ISO 16). That reference is called concert pitch. When people say they want music “in 432,” they usually mean: shift the whole recording so that same reference A lands near 432 Hz instead.",
      },
      {
        type: "h3",
        text: "The math (simple)",
      },
      {
        type: "formula",
        label: "Pitch ratio",
        value: LEARN_RATIO,
      },
      {
        type: "formula",
        label: "Cents (pitch change)",
        value: LEARN_CENTS,
      },
      {
        type: "p",
        text: "Play In 432 multiplies every frequency in the mix by that ratio. A pure 440 Hz tone becomes 432 Hz. A chord, vocal, and kick drum all move together by the same relative amount. Tempo (how long the song lasts) is held at 1.0 — this is a pitch shift with time preserved, not “play the file slower.”",
      },
      {
        type: "ul",
        items: [
          "Source A — the concert pitch you assume the track was mixed for (default 440).",
          "Target A — where you want that reference to land (default 432).",
          "Ratio = target ÷ source. Cents = 1200 × log₂(ratio).",
          "You can also use 444, reverse 432→440, or a custom pair.",
        ],
      },
      {
        type: "callout",
        tone: "tech",
        title: "TrueHz technology",
        text: "Live listening uses SoundTouch-class processing for instant A/B. Choose Re-anchor (Solfeggio note map, small shifts) or Concert A (full target÷source). Download HQ uses the same style via TrueHz Convert. Optional TrueHz pure-tone bed is an exact sine at the labeled Hz. Hear the difference demos the effective A4 ratio.",
      },
    ],
  },
  {
    id: "what-it-is-not",
    title: "What we will never claim",
    summary:
      "Why a mixed song is not “pure 432 Hz throughout” — and how we stay honest.",
    minutes: 3,
    category: "Basics",
    sections: [
      {
        type: "p",
        text: "A finished song is not a single sine wave. It is thousands of frequencies at once: fundamentals, overtones, noise, effects, and mastering EQ. After a ratio retune, the whole spectrum shifts — but there is still no single “the frequency of this song” number that equals 432.00 for every peak.",
      },
      {
        type: "h3",
        text: "Honest product language",
      },
      {
        type: "ul",
        items: [
          "We say: retuned by concert-pitch ratio (e.g. A=440 → A=432).",
          "We show: ratio and cents on screen.",
          "We do not say: “this track is exactly 432 Hz” as if the mix were a pure tone.",
          "We do not promise medical cures, DNA repair, or conspiracy narratives.",
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Avoid fake 432 marketing",
        text: "Many uploads labeled “432 Hz music” are ordinary tracks with a sticker on the title. Without a defined source pitch and a documented ratio (or a pure generated tone), the label is marketing, not measurement. Play In 432 is transparent about the operation it performs.",
      },
      {
        type: "p",
        text: "If you want an exact labeled frequency, use the TrueHz pure-tone bed (or TrueHz Precision Tuning elsewhere in the Rise In Harmony family). That layer is generated at a stated Hz — not reverse-engineered from a pop mix.",
      },
    ],
  },
  {
    id: "truehz-pure-tones",
    title: "TrueHz pure tones vs retuned music",
    summary:
      "Exact generated sine waves versus whole-mix pitch shift — two different tools.",
    minutes: 4,
    category: "TrueHz",
    sections: [
      {
        type: "h3",
        text: "Retuned music (Play In 432)",
      },
      {
        type: "p",
        text: "Your upload is pitch-shifted by target/source. Good for listening to songs, podcasts, or albums with a different concert reference. Live preview is optimized for speed; Download HQ uses TrueHz Convert for cleaner music quality.",
      },
      {
        type: "h3",
        text: "TrueHz pure-tone bed",
      },
      {
        type: "p",
        text: "A mathematically generated sine at the target frequency (for example 432.00 Hz) mixed quietly under the track. That bed can be verified with a tuner or spectrum analyzer. It does not turn the song into a pure tone; it adds a known carrier.",
      },
      {
        type: "ul",
        items: [
          "Generation idea: sample-accurate sin(2π · f · n / sampleRate).",
          "Default use: low level under music (−18 dB-class bed, user adjustable).",
          "Claim boundary: only the generated layer is “exact labeled Hz.”",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Hybrid listening",
        text: "Retune the mix for A=432 reference, then optionally enable the TrueHz bed for a verified 432.00 Hz sine underneath. That is the honest dual-layer model — not “the Spotify track is pure 432.”",
      },
    ],
  },
  {
    id: "reanchor-vs-concert",
    title: "Re-anchor vs Concert A",
    summary:
      "Why 741 / 852 / 963 can stay listenable: note re-anchor, not “A = 852.”",
    minutes: 4,
    category: "Basics",
    sections: [
      {
        type: "p",
        text: "Play In 432 offers two ways to turn a frequency chip into a pitch scale. Both keep tempo at 1.0. They answer different questions — and high Solfeggio labels only stay musical if you use the right one.",
      },
      {
        type: "h3",
        text: "Concert A (classic TrueHz ratio)",
      },
      {
        type: "ul",
        items: [
          "Meaning: shift the whole mix so concert A moves from Source A to Target A.",
          "Math: ratio = target ÷ source (e.g. 432 ÷ 440 ≈ 0.9818, −31.8 ¢).",
          "Best for: 440→432, 444, reverse 432→440, and any custom A pair.",
          "Problem at high labels: 852 ÷ 440 ≈ 1.94 — almost +1 octave. Music jumps hard; artifacts rise. That is honest DSP, not a bug.",
        ],
      },
      {
        type: "h3",
        text: "Re-anchor (Solfeggio / HZP-style)",
      },
      {
        type: "p",
        text: "HZP-style players do not “blast the raw Solfeggio number” as the new A4. They treat each label as a named note, then shift only enough for that note to land on the labeled Hz. The rest of the tuning moves with it — so A4 only moves a little.",
      },
      {
        type: "ul",
        items: [
          "174 → F3 · 285 → C♯4 · 396 → G4 · 417 → G♯4 · 432/440/444 → A4",
          "528 → C5 · 639 → D♯5 · 741 → F♯5 · 852 → G♯5 · 963 → B5",
          "Math: ratio = labeledHz ÷ (that note’s frequency at Source A in 12-TET).",
          "Example: at A=440, B5 ≈ 987.8 Hz. Re-anchor 963 → ratio 963/987.8 ≈ 0.975 (−44 ¢). Implied A4 ≈ 429 Hz — not 963.",
          "Example: F♯5 at A=440 is already ~740 Hz. Re-anchor 741 is nearly a no-op on the mix.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "What you heard vs “drop an octave”",
        text: "Compared with Concert A at 741/852/963, Re-anchor often sounds about an octave lower — because Concert A was going almost an octave up. Re-anchor is not “always divide by two after a big shift”; it is “small cents so this note matches the label.”",
      },
      {
        type: "h3",
        text: "When to use which",
      },
      {
        type: "ul",
        items: [
          "Daily 432 listening → either style (for A4 targets they match).",
          "Solfeggio chips 174–963 without wrecking the song → Re-anchor.",
          "Explicit “move concert A from 440 to X” → Concert A.",
          "Want an exact sine at 741.00 / 852.00 / 963.00 under the track → TrueHz pure-tone bed (always exact labeled Hz; independent of mix style).",
        ],
      },
      {
        type: "callout",
        tone: "tech",
        title: "TrueHz honesty",
        text: "Re-anchor still does not make a mixed song “pure 852 Hz throughout.” It only applies a small, documented ratio. The optional bed is the only exact-Hz layer. Download HQ uses the same style you selected for live play.",
      },
    ],
  },
  {
    id: "how-far-to-retune",
    title: "How far should you retune?",
    summary:
      "Larger Hz jumps stress the mix more. Closest targets usually sound best.",
    minutes: 3,
    category: "Quality",
    sections: [
      {
        type: "p",
        text: "Every retune multiplies the whole mix by target ÷ source. Small ratios move pitch a little; large ratios move it a lot. The farther you go, the harder pitch-shifting becomes — voices, pianos, and cymbals show artifacts first (smearing, “chipmunk/warble,” or hollow formants).",
      },
      {
        type: "h3",
        text: "Rule of thumb: closer is cleaner",
      },
      {
        type: "ul",
        items: [
          "Best everyday result: A=440 → A=432 (~−31.8 ¢) or 444 — or use Re-anchor style for Solfeggio chips.",
          "In Concert A mode, large jumps (e.g. 440 → 852 as A) are big transpositions; prefer Re-anchor for those labels.",
          "In Re-anchor mode, high labels only move A a little (see “Re-anchor vs Concert A”).",
          "If two anchors feel similar, pick the closer musical result — not the bigger number.",
        ],
      },
      {
        type: "h3",
        text: "Rough size guide (from A=440)",
      },
      {
        type: "ul",
        items: [
          "432 / 444 — small: usually the cleanest “whole album” experience.",
          "396–528 range — medium: still listenable; HQ export helps on voice-heavy tracks.",
          "174 / 285 or 741–963 — large: strong pitch move; artifacts more likely on live preview; prefer short A/B tests and HQ if you save.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Best practice",
        text: "For daily listening, prefer the closest honest option (usually 440→432). Use far Solfeggio-style anchors when you want a deliberate experiment — not because “bigger Hz = better.” Quality is about small, accurate ratio shifts, not max distance.",
      },
      {
        type: "h3",
        text: "Two better tools for “exact Hz”",
      },
      {
        type: "ul",
        items: [
          "TrueHz pure-tone bed — generated sine at the labeled Hz under the track (exact layer; mix still retuned separately).",
          "Hear the difference — pure A4 A/B so you hear the ratio without mix complexity.",
          "Download HQ (TrueHz Convert) — when a larger shift is intentional and you need a keepable file.",
        ],
      },
      {
        type: "callout",
        tone: "tech",
        title: "Why engines struggle on big shifts",
        text: "Pitch-shift algorithms estimate harmonics and stretch them. A −32 ¢ move is a small correction; a multi-semitone move is closer to transposition. Formant preservation (HQ path) helps vocals, but physics still wins: larger ratio = more room for artifacts. That is DSP reality, not a product limit unique to Play In 432.",
      },
    ],
  },
  {
    id: "preview-vs-export",
    title: "Live preview vs high-quality export",
    summary:
      "One product: Play In 432. Live uses SoundTouch; Download HQ uses TrueHz Convert.",
    minutes: 3,
    category: "Quality",
    sections: [
      {
        type: "p",
        text: "Pitch-shifting music while keeping duration is a hard DSP problem. Different engines trade quality, CPU, and artifacts (especially on voice and piano). Larger target jumps make those artifacts more obvious — see “How far should you retune?” Play In 432 combines live + HQ paths under TrueHz technology.",
      },
      {
        type: "h3",
        text: "Live preview (listen now)",
      },
      {
        type: "ul",
        items: [
          "Live A/B: Original vs Retune while you listen.",
          "Engine: SoundTouch-class processing in the browser.",
          "Best for: trying ratios, scrubbing, everyday listening without waiting.",
        ],
      },
      {
        type: "h3",
        text: "Download HQ — TrueHz Convert engine",
      },
      {
        type: "ul",
        items: [
          "Button: Download HQ WAV.",
          "Offline worker: decode → TrueHz Convert (high quality, formant-preserved) → optional TrueHz pure-tone bed → 16-bit WAV.",
          "Same ratio math as live (target ÷ source).",
          "Use when you need files for phone, car, or archive.",
          "If TrueHz Convert fails to load, export falls back to the preview engine and tells you.",
        ],
      },
      {
        type: "callout",
        tone: "tech",
        title: "Same math, different engine",
        text: "Both paths use the same concert-pitch ratio (target ÷ source). The difference is algorithm quality and export pipeline — not a different definition of “432.” Brand: Play In 432 · powered by TrueHz technology.",
      },
    ],
  },
  {
    id: "how-to-verify",
    title: "How to verify pitch yourself",
    summary:
      "Simple checks with a tuner, spectrum tools, and pure tones.",
    minutes: 4,
    category: "Verify",
    sections: [
      {
        type: "h3",
        text: "1. Verify a pure tone (easiest)",
      },
      {
        type: "ul",
        items: [
          "Enable only the TrueHz pure-tone bed (or generate a sine in another TrueHz tool).",
          "Play into a chromatic tuner or spectrum app (phone or desktop).",
          "You should see the labeled frequency (e.g. 432 Hz) within a small tolerance.",
        ],
      },
      {
        type: "h3",
        text: "2. Verify a ratio retune on a known tone",
      },
      {
        type: "p",
        text: "If you have a file that is a pure 440 Hz test tone, retune with source 440 → target 432. Measure again: the peak should land near 432 Hz. That validates the ratio path.",
      },
      {
        type: "h3",
        text: "3. Mixed music (what you can and cannot prove)",
      },
      {
        type: "ul",
        items: [
          "You can confirm relative shift (everything moved down ~31.8 ¢ for 440→432).",
          "You cannot reduce a complex mix to one “exact 432” peak and call the whole song that frequency.",
          "Trust the documented ratio + cents display more than a single spectral peak on a dense mix.",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Tools people use",
        text: "Chromatic tuners, free spectrum analyzers (e.g. desktop tools or DAW analyzers), and side-by-side A/B of Original vs Retune in Play In 432. No special hardware required for a basic check.",
      },
    ],
  },
  {
    id: "research-limits",
    title: "Music, stress, and research — with limits",
    summary:
      "What studies can suggest about listening — without medical claims.",
    minutes: 4,
    category: "Research",
    sections: [
      {
        type: "p",
        text: "People often feel calmer with quieter mixes, slower perceived brightness, or personal preference for a slightly lower tuning. Preference is real. Medical marketing is not our product.",
      },
      {
        type: "h3",
        text: "What research sometimes explores",
      },
      {
        type: "ul",
        items: [
          "Music listening and stress markers (heart rate, reported anxiety, cortisol in limited lab settings).",
          "Psychoacoustics: pitch, loudness, and timbre affect comfort and fatigue.",
          "Binaural beats and entrainment (a different mechanism from concert-pitch retune — do not confuse them).",
        ],
      },
      {
        type: "h3",
        text: "What we will not claim",
      },
      {
        type: "ul",
        items: [
          "Play In 432 does not diagnose, treat, or cure disease.",
          "A ratio retune is not the same as a clinical therapy protocol.",
          "Single small studies (including popular “432 vs 440” papers) are not universal proof for every listener or every track.",
          "Phi, DNA, or conspiracy stories are not part of TrueHz product claims.",
        ],
      },
      {
        type: "callout",
        tone: "warn",
        title: "Read studies carefully",
        text: "Sample size, controls, blinding, and what was actually played (pure tones vs full mixes vs “432 labeled” files) matter. If a headline says “432 Hz reduces cortisol 60%,” ask: who, what audio, what protocol, what replication? We encourage curiosity — and skepticism of overclaim.",
      },
      {
        type: "p",
        text: "Our job: accurate retune math, transparent labeling, optional verified pure tones. Your job: decide what you enjoy. That separation is intentional.",
      },
    ],
  },
];

export function getLearnArticle(id: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.id === id);
}

export const LEARN_CATEGORIES = [
  "Basics",
  "TrueHz",
  "Quality",
  "Verify",
  "Research",
] as const;
