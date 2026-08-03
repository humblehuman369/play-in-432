/**
 * TrueHz Convert engine — Signalsmith Stretch offline pitch-shift.
 *
 * MIT-licensed replacement for the Rubber Band (GPL) HQ path.
 * Renders through OfflineAudioContext + the official Signalsmith
 * AudioWorklet release. Duration is preserved (rate = 1, pitch-only),
 * matching the previous engine's contract exactly.
 *
 * Place at: src/lib/exportSignalsmith.ts
 */
import SignalsmithStretch from "signalsmith-stretch";
import { effectivePitchRatio, type RetuneStyle } from "./retune";

/**
 * Schedule-ahead margin fallback (seconds) if the node can't report its
 * own latency. Generous on purpose; the excess is trimmed after render.
 */
const FALLBACK_LEAD_S = 0.3;
/** Extra tail (seconds) so the engine can flush; trimmed after render. */
const TAIL_S = 1.0;
/** Music-friendly default per Signalsmith docs. Not user-configurable. */
const TONALITY_HZ = 8000;

/**
 * Offline HQ pitch-shift, same signature as renderRetunedRubberBand.
 * Output is always 2 channels, same sample rate, same frame count as input.
 */
export async function renderRetunedSignalsmith(
  buffer: AudioBuffer,
  sourceA: number,
  targetA: number,
  onProgress?: (fraction: number, status?: string) => void,
  style: RetuneStyle = "concert",
): Promise<AudioBuffer> {
  const ratio = effectivePitchRatio(sourceA, targetA, style);
  const sampleRate = buffer.sampleRate;
  const inputFrames = buffer.length;
  const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));

  if (inputFrames < 1) throw new Error("No audio data to process");

  if (Math.abs(ratio - 1) < 1e-9) {
    onProgress?.(1, "Identity ratio — no shift needed");
    return buffer;
  }

  // Fractional semitones are fully supported by the engine
  // (440 -> 432 is -0.3176 st; no rounding happens anywhere).
  const semitones = 12 * Math.log2(ratio);

  // Copy channel data (never hand the AudioBuffer's own memory around).
  const left = new Float32Array(buffer.getChannelData(0));
  const right =
    channels > 1
      ? new Float32Array(buffer.getChannelData(1))
      : left; // mono: same array for both channels is fine for addBuffers

  onProgress?.(0.02, "Loading TrueHz Convert engine…");

  // Render context is sized with generous head+tail padding; we trim to
  // exactly inputFrames afterwards, so downstream (bed mixer, WAV/MP3)
  // sees identical dimensions to the old engine's output.
  const maxLeadFrames = Math.ceil((FALLBACK_LEAD_S + 0.5) * sampleRate);
  const tailFrames = Math.ceil(TAIL_S * sampleRate);
  const totalFrames = inputFrames + maxLeadFrames + tailFrames;

  const ctx = new OfflineAudioContext(2, totalFrames, sampleRate);

  const node = await SignalsmithStretch(ctx, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  onProgress?.(0.04, "Preparing audio…");
  await node.addBuffers([left, right]);

  // Schedule ahead by the node's own latency so the very first frames are
  // full quality (the docs note un-scheduled starts "catch up" softly).
  let lead = FALLBACK_LEAD_S;
  try {
    const l = node.latency();
    if (typeof l === "number" && Number.isFinite(l) && l >= 0 && l < 2) {
      lead = Math.max(l, 0.05);
    }
  } catch {
    /* keep fallback */
  }
  const leadFrames = Math.round(lead * sampleRate);

  node.schedule({
    output: lead,
    input: 0,
    rate: 1,
    semitones,
    tonalityHz: TONALITY_HZ,
    active: true,
  });
  node.start(lead);
  node.connect(ctx.destination);

  // Progress via suspend/resume at ~5% intervals. All suspends must be
  // registered before startRendering(). Failures are non-fatal (progress
  // just gets coarser), so each suspend promise is individually guarded.
  const renderSeconds = totalFrames / sampleRate;
  const steps = 20;
  for (let i = 1; i < steps; i++) {
    const t = (renderSeconds * i) / steps;
    ctx
      .suspend(t)
      .then(() => {
        onProgress?.(
          0.05 + (i / steps) * 0.9,
          "Pitch-shifting (TrueHz Convert HQ)…",
        );
        return ctx.resume();
      })
      .catch(() => {
        /* suspend not supported at this time — ignore */
      });
  }

  const rendered = await ctx.startRendering();
  onProgress?.(0.97, "Finalizing…");

  // Trim: audio corresponding to input t=0 begins at `lead` seconds
  // (the node compensates its latency for scheduled output times).
  // Output length is forced to exactly inputFrames.
  const offline = new OfflineAudioContext(2, inputFrames, sampleRate);
  const out = offline.createBuffer(2, inputFrames, sampleRate);
  for (let c = 0; c < 2; c++) {
    const src = rendered.getChannelData(
      Math.min(c, rendered.numberOfChannels - 1),
    );
    const start = Math.min(leadFrames, Math.max(0, src.length - inputFrames));
    out.getChannelData(c).set(src.subarray(start, start + inputFrames));
  }

  onProgress?.(0.99);
  return out;
}
