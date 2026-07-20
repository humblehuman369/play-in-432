/**
 * Play In 432 export pipeline
 *
 * Live preview → SoundTouch (playerEngine)
 * HQ download  → TrueHz Convert engine (Rubber Band WASM offline)
 * Fallback     → SoundTouch offline if Rubber Band fails
 */
import {
  SimpleFilter,
  SoundTouch,
  WebAudioBufferSource,
} from "soundtouchjs";
import {
  effectivePitchRatio,
  safeFileStem,
  type RetuneStyle,
} from "./retune";
import { BRAND } from "./brand";
import type {
  RubberBandWorkerIn,
  RubberBandWorkerOut,
} from "../workers/rubberbandWorker";

const CHUNK_FRAMES = 4096;

export type ExportEngine = "rubberband" | "soundtouch";

export type ExportResult = {
  engine: ExportEngine;
  /** True when Rubber Band was requested but SoundTouch fallback ran. */
  usedFallback: boolean;
};

/**
 * Offline pitch-shift (tempo = 1) via SoundTouch — fallback / legacy path.
 */
export async function renderRetunedSoundTouch(
  buffer: AudioBuffer,
  sourceA: number,
  targetA: number,
  onProgress?: (fraction: number) => void,
  style: RetuneStyle = "concert",
): Promise<AudioBuffer> {
  const ratio = effectivePitchRatio(sourceA, targetA, style);
  const sampleRate = buffer.sampleRate;
  const sourceFrames = buffer.length;

  if (Math.abs(ratio - 1) < 1e-9) {
    onProgress?.(1);
    return buffer;
  }

  const soundTouch = new SoundTouch();
  soundTouch.tempo = 1;
  soundTouch.pitch = ratio;

  const source = new WebAudioBufferSource(buffer);
  const filter = new SimpleFilter(source, soundTouch, () => {});

  const leftChunks: Float32Array[] = [];
  const rightChunks: Float32Array[] = [];
  let totalFrames = 0;
  const samples = new Float32Array(CHUNK_FRAMES * 2);
  let iterations = 0;

  while (true) {
    const n = filter.extract(samples, CHUNK_FRAMES);
    if (n === 0) break;

    const L = new Float32Array(n);
    const R = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      L[i] = samples[i * 2];
      R[i] = samples[i * 2 + 1];
    }
    leftChunks.push(L);
    rightChunks.push(R);
    totalFrames += n;
    iterations++;

    if (iterations % 24 === 0) {
      const frac = Math.min(
        0.99,
        filter.sourcePosition / Math.max(1, sourceFrames),
      );
      onProgress?.(frac);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(1);

  const frames = Math.max(1, totalFrames);
  const offline = new OfflineAudioContext(2, frames, sampleRate);
  const out = offline.createBuffer(2, frames, sampleRate);
  const ch0 = out.getChannelData(0);
  const ch1 = out.getChannelData(1);

  let offset = 0;
  for (let c = 0; c < leftChunks.length; c++) {
    const L = leftChunks[c];
    const R = rightChunks[c];
    ch0.set(L, offset);
    ch1.set(R, offset);
    offset += L.length;
  }

  return out;
}

/** @deprecated Use renderRetunedSoundTouch or renderRetunedHq */
export const renderRetunedAudioBuffer = renderRetunedSoundTouch;

/**
 * TrueHz Convert — Rubber Band offline pitch-shift in a worker.
 */
export async function renderRetunedRubberBand(
  buffer: AudioBuffer,
  sourceA: number,
  targetA: number,
  onProgress?: (fraction: number, status?: string) => void,
  style: RetuneStyle = "concert",
): Promise<AudioBuffer> {
  const ratio = effectivePitchRatio(sourceA, targetA, style);
  const sampleRate = buffer.sampleRate;
  const channels = Math.min(2, Math.max(1, buffer.numberOfChannels));

  if (Math.abs(ratio - 1) < 1e-9) {
    onProgress?.(1, "Identity ratio — no shift needed");
    return cloneAudioBuffer(buffer, channels);
  }

  const channelBuffers: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    // Copy so we can transfer without detaching the AudioBuffer's memory
    channelBuffers.push(new Float32Array(buffer.getChannelData(c)));
  }

  const outs = await runRubberBandWorker({
    channelBuffers,
    sampleRate,
    pitchScale: ratio,
    timeRatio: 1,
    onProgress,
  });

  const frames = outs[0]?.length ?? 0;
  if (frames < 1) throw new Error("Rubber Band produced empty output");

  const offline = new OfflineAudioContext(2, frames, sampleRate);
  const out = offline.createBuffer(2, frames, sampleRate);
  // Copy into channel data (avoids Float32Array<ArrayBufferLike> transfer typing issues)
  out.getChannelData(0).set(outs[0]);
  out.getChannelData(1).set(outs[channels > 1 ? 1 : 0]);
  return out;
}

/**
 * HQ path preferred; falls back to SoundTouch if WASM/worker fails.
 */
export async function renderRetunedHq(
  buffer: AudioBuffer,
  sourceA: number,
  targetA: number,
  onProgress?: (fraction: number, status?: string) => void,
  style: RetuneStyle = "concert",
): Promise<{ buffer: AudioBuffer; engine: ExportEngine; usedFallback: boolean }> {
  try {
    onProgress?.(0.01, `${BRAND.convertProduct} · Rubber Band HQ`);
    const rendered = await renderRetunedRubberBand(
      buffer,
      sourceA,
      targetA,
      onProgress,
      style,
    );
    return { buffer: rendered, engine: "rubberband", usedFallback: false };
  } catch (e) {
    console.warn("[TrueHz Convert] Rubber Band failed, using SoundTouch:", e);
    onProgress?.(0.05, "Rubber Band unavailable — using preview-quality engine");
    const rendered = await renderRetunedSoundTouch(
      buffer,
      sourceA,
      targetA,
      (f) => onProgress?.(f, "SoundTouch fallback"),
      style,
    );
    return { buffer: rendered, engine: "soundtouch", usedFallback: true };
  }
}

/** Mix a TrueHz pure sine bed under the buffer (exact targetA Hz). */
export function mixTrueHzBed(
  buffer: AudioBuffer,
  targetA: number,
  level: number,
): AudioBuffer {
  const gain = Math.min(0.25, Math.max(0, level));
  if (gain < 1e-6) return buffer;

  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const channels = Math.min(2, buffer.numberOfChannels);
  const offline = new OfflineAudioContext(2, frames, sampleRate);
  const out = offline.createBuffer(2, frames, sampleRate);
  const twoPiF = (2 * Math.PI * targetA) / sampleRate;

  for (let c = 0; c < 2; c++) {
    const src = buffer.getChannelData(Math.min(c, channels - 1));
    const dst = out.getChannelData(c);
    for (let i = 0; i < frames; i++) {
      const bed = Math.sin(twoPiF * i) * gain;
      const mixed = src[i] + bed;
      dst[i] = Math.max(-1, Math.min(1, mixed));
    }
  }
  return out;
}

function cloneAudioBuffer(buffer: AudioBuffer, channels: number): AudioBuffer {
  const ch = Math.min(2, Math.max(1, channels));
  const offline = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
  const out = offline.createBuffer(2, buffer.length, buffer.sampleRate);
  out.copyToChannel(buffer.getChannelData(0), 0);
  out.copyToChannel(
    buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0),
    1,
  );
  if (ch === 1) {
    // already duplicated mono to both; fine for stereo WAV
  }
  return out;
}

function runRubberBandWorker(opts: {
  channelBuffers: Float32Array[];
  sampleRate: number;
  pitchScale: number;
  timeRatio: number;
  onProgress?: (fraction: number, status?: string) => void;
}): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../workers/rubberbandWorker.ts", import.meta.url),
        { type: "module" },
      );
    } catch (e) {
      reject(
        e instanceof Error
          ? e
          : new Error("Could not start TrueHz Convert worker"),
      );
      return;
    }

    let settled = false;
    const cleanup = () => {
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const succeed = (bufs: Float32Array[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(bufs);
    };

    worker.onerror = (ev) => {
      fail(ev.message || "Rubber Band worker error");
    };

    worker.onmessage = (ev: MessageEvent<RubberBandWorkerOut>) => {
      const msg = ev.data;
      if (!msg || !("type" in msg)) return;

      switch (msg.type) {
        case "ready": {
          const payload: RubberBandWorkerIn = {
            type: "process",
            channelBuffers: opts.channelBuffers,
            sampleRate: opts.sampleRate,
            pitchScale: opts.pitchScale,
            timeRatio: opts.timeRatio,
          };
          const transfer = opts.channelBuffers.map((b) => b.buffer);
          worker.postMessage(payload, transfer);
          break;
        }
        case "status":
          opts.onProgress?.(-1, msg.status);
          break;
        case "progress":
          opts.onProgress?.(msg.progress);
          break;
        case "done":
          succeed(msg.channelBuffers);
          break;
        case "error":
          fail(msg.message);
          break;
      }
    };

    // Safety timeout: 10 min for long albums
    setTimeout(() => fail("HQ export timed out"), 10 * 60 * 1000);
  });
}

/** Encode AudioBuffer as 16-bit stereo PCM WAV. */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const ab = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(ab);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  const ch0 = buffer.getChannelData(0);
  const ch1 =
    numChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0);

  let o = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, ch0[i]));
    const r = Math.max(-1, Math.min(1, ch1[i]));
    view.setInt16(o, (l < 0 ? l * 0x8000 : l * 0x7fff) | 0, true);
    o += 2;
    if (numChannels > 1) {
      view.setInt16(o, (r < 0 ? r * 0x8000 : r * 0x7fff) | 0, true);
      o += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function retunedDownloadName(
  trackName: string,
  sourceA: number,
  targetA: number,
  engine: ExportEngine = "rubberband",
): string {
  const stem = safeFileStem(trackName);
  const s = Math.round(sourceA);
  const t = Math.round(targetA);
  const tag = engine === "rubberband" ? "TrueHz-HQ" : "preview";
  return `${stem}_A${s}-A${t}_${tag}.wav`;
}

/**
 * Decode blob → TrueHz Convert HQ retune → WAV download.
 * Optional TrueHz pure-tone bed mixed when bedOn is true.
 */
export async function exportRetunedWav(opts: {
  arrayBuffer: ArrayBuffer;
  trackName: string;
  sourceA: number;
  targetA: number;
  retuneStyle?: RetuneStyle;
  /** Mix TrueHz pure sine at targetA under the retuned track. */
  bedOn?: boolean;
  bedLevel?: number;
  onProgress?: (fraction: number, status?: string) => void;
}): Promise<ExportResult> {
  const ctx = new AudioContext();
  const style = opts.retuneStyle ?? "concert";
  try {
    opts.onProgress?.(0.02, "Decoding audio…");
    const buffer = await ctx.decodeAudioData(opts.arrayBuffer.slice(0));

    const { buffer: rendered, engine, usedFallback } = await renderRetunedHq(
      buffer,
      opts.sourceA,
      opts.targetA,
      opts.onProgress,
      style,
    );

    let finalBuf = rendered;
    if (opts.bedOn && (opts.bedLevel ?? 0) > 0) {
      opts.onProgress?.(0.97, `${BRAND.bedLabel}…`);
      finalBuf = mixTrueHzBed(
        rendered,
        opts.targetA,
        opts.bedLevel ?? 0.04,
      );
    }

    opts.onProgress?.(0.99, "Encoding WAV…");
    const blob = audioBufferToWavBlob(finalBuf);
    triggerDownload(
      blob,
      retunedDownloadName(opts.trackName, opts.sourceA, opts.targetA, engine),
    );
    opts.onProgress?.(1, "Done");
    return { engine, usedFallback };
  } finally {
    await ctx.close();
  }
}
