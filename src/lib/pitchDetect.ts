/**
 * Best-effort concert-pitch A estimate from an AudioBuffer.
 * Uses autocorrelation on a mono mid-track window — honest, not lab-grade.
 */

export type PitchEstimate = {
  /** Estimated concert A in Hz (e.g. 440.3) */
  estimatedA: number;
  /** 0–1 relative confidence from peak / rms */
  confidence: number;
  /** Dominant detected fundamental in analysis window */
  fundamentalHz: number;
  /** Octave-normalized note nearest that fundamental */
  noteName: string;
};

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];

function midiToNoteName(midi: number): string {
  const n = ((Math.round(midi) % 12) + 12) % 12;
  const oct = Math.floor(Math.round(midi) / 12) - 1;
  return `${NOTE_NAMES[n]}${oct}`;
}

/**
 * Map a detected fundamental to concert A by assuming the nearest
 * chromatic note relative to A4=440, then scaling.
 * e.g. if we hear 329.6 Hz (E4), concert A ≈ 440.
 */
function fundamentalToConcertA(f0: number): number {
  if (f0 <= 0) return 440;
  // MIDI number for f0 if A4=440
  const midi = 69 + 12 * Math.log2(f0 / 440);
  const nearest = Math.round(midi);
  const expectedF = 440 * Math.pow(2, (nearest - 69) / 12);
  if (expectedF <= 0) return 440;
  // How much the actual pitch is sharp/flat vs equal temperament @ A=440
  return 440 * (f0 / expectedF);
}

/**
 * Autocorrelation pitch detector (YIN-inspired peak pick, simplified).
 * Returns fundamental Hz or null.
 */
function detectFundamental(
  samples: Float32Array,
  sampleRate: number,
  minHz = 70,
  maxHz = 1000,
): { f0: number; clarity: number } | null {
  const n = samples.length;
  if (n < 1024) return null;

  // Remove DC + light normalize
  let mean = 0;
  for (let i = 0; i < n; i++) mean += samples[i];
  mean /= n;
  let rms = 0;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = samples[i] - mean;
    rms += x[i] * x[i];
  }
  rms = Math.sqrt(rms / n);
  if (rms < 1e-5) return null;

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.min(Math.floor(sampleRate / minHz), n - 2);
  if (maxLag <= minLag + 2) return null;

  // Normalized autocorrelation
  const corr = new Float32Array(maxLag + 1);
  let bestLag = minLag;
  let best = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let nrg = 0;
    const len = n - lag;
    for (let i = 0; i < len; i++) {
      sum += x[i] * x[i + lag];
      nrg += x[i] * x[i] + x[i + lag] * x[i + lag];
    }
    const c = nrg > 0 ? (2 * sum) / nrg : 0;
    corr[lag] = c;
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }

  // Require a reasonably clear peak
  if (best < 0.35) return null;

  // Parabolic interpolation around peak
  const y0 = corr[bestLag - 1] ?? best;
  const y1 = best;
  const y2 = corr[bestLag + 1] ?? best;
  const denom = 2 * (2 * y1 - y2 - y0);
  const shift = denom !== 0 ? (y0 - y2) / denom : 0;
  const refinedLag = bestLag + Math.max(-1, Math.min(1, shift));
  const f0 = sampleRate / refinedLag;
  if (f0 < minHz || f0 > maxHz) return null;

  return { f0, clarity: Math.max(0, Math.min(1, best)) };
}

function mixMono(buffer: AudioBuffer, start: number, length: number): Float32Array {
  const ch0 = buffer.getChannelData(0);
  const ch1 =
    buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const idx = start + i;
    out[i] = (ch0[idx] + ch1[idx]) * 0.5;
  }
  return out;
}

/**
 * Estimate concert A from a buffer. Analyzes up to 3 windows and averages
 * confident results.
 */
export async function estimateConcertA(
  buffer: AudioBuffer,
): Promise<PitchEstimate | null> {
  const sr = buffer.sampleRate;
  const total = buffer.length;
  if (total < sr * 0.5) return null;

  // Prefer mid-song energy; avoid pure silence intro
  const winSec = Math.min(2.5, buffer.duration * 0.4);
  const win = Math.floor(winSec * sr);
  const starts = [
    Math.floor(total * 0.15),
    Math.floor(total * 0.4),
    Math.floor(total * 0.65),
  ].filter((s) => s + win < total);

  const results: { f0: number; clarity: number }[] = [];

  for (let i = 0; i < starts.length; i++) {
    const mono = mixMono(buffer, starts[i], win);
    // Downsample-ish: use every sample is fine for ≤2.5s @ 48k (~120k samples)
    // Cap to 48k samples for speed
    let slice = mono;
    if (mono.length > 48000) {
      slice = mono.subarray(0, 48000);
    }
    const hit = detectFundamental(slice, sr);
    if (hit) results.push(hit);
    // Yield so UI stays responsive
    if (i < starts.length - 1) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  if (!results.length) return null;

  // Weighted average by clarity
  let wSum = 0;
  let fSum = 0;
  let cSum = 0;
  for (const r of results) {
    wSum += r.clarity;
    fSum += r.f0 * r.clarity;
    cSum += r.clarity;
  }
  const f0 = fSum / wSum;
  const clarity = cSum / results.length;
  const estimatedA = fundamentalToConcertA(f0);

  // Sanity: concert A usually 415–466 historically; widen slightly
  if (estimatedA < 380 || estimatedA > 500) {
    // Still return but mark lower confidence
    return {
      estimatedA: Math.round(estimatedA * 10) / 10,
      confidence: clarity * 0.4,
      fundamentalHz: Math.round(f0 * 10) / 10,
      noteName: midiToNoteName(69 + 12 * Math.log2(f0 / 440)),
    };
  }

  return {
    estimatedA: Math.round(estimatedA * 10) / 10,
    confidence: Math.round(clarity * 100) / 100,
    fundamentalHz: Math.round(f0 * 10) / 10,
    noteName: midiToNoteName(69 + 12 * Math.log2(f0 / 440)),
  };
}
