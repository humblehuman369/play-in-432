/**
 * Offscreen: tab audio → SoundTouch pitch (tempo preserved) → speakers.
 * Uses vendor soundtouch.js (LGPL) — same library family as the web app live path.
 */
import { SoundTouch, SimpleFilter } from "./soundtouch.js";

let audioCtx = null;
let mediaStream = null;
let processor = null;
let sourceNode = null;
let soundTouch = null;
let filter = null;
let ratio = 1;

// Ring buffer of interleaved stereo float samples from the capture stream
const INPUT_CAP = 48000 * 4; // ~4s @ 48k stereo-ish mono feed
let inputBuf = new Float32Array(INPUT_CAP);
let inputLen = 0;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TRUEHZ_OFFSCREEN_START") {
    void start(msg.streamId, msg.ratio ?? 1);
  }
  if (msg?.type === "TRUEHZ_OFFSCREEN_STOP") {
    stop();
  }
  if (msg?.type === "TRUEHZ_OFFSCREEN_RATIO" && soundTouch) {
    ratio = Number(msg.ratio) || 1;
    soundTouch.pitch = ratio;
    soundTouch.tempo = 1;
  }
});

/**
 * Minimal source adapter for SimpleFilter: pull mono samples from ring buffer.
 */
class CaptureSource {
  constructor() {
    this.position = 0;
  }
  extract(target, numFrames) {
    const n = Math.min(numFrames, inputLen);
    if (n <= 0) {
      target.fill(0);
      return 0;
    }
    // Interleave mono → stereo frames for SoundTouch (L,R,L,R…)
    for (let i = 0; i < n; i++) {
      const s = inputBuf[i];
      target[i * 2] = s;
      target[i * 2 + 1] = s;
    }
    // Shift remaining
    inputBuf.copyWithin(0, n, inputLen);
    inputLen -= n;
    this.position += n;
    return n;
  }
}

async function start(streamId, pitchRatio) {
  stop();
  ratio = Number(pitchRatio) || 1;

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Chrome tab capture constraint shape
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  });

  audioCtx = new AudioContext();
  const sr = audioCtx.sampleRate;

  soundTouch = new SoundTouch();
  soundTouch.pitch = ratio;
  soundTouch.tempo = 1;
  filter = new SimpleFilter(new CaptureSource(), soundTouch);

  sourceNode = audioCtx.createMediaStreamSource(mediaStream);

  // ScriptProcessor is deprecated but works in offscreen for MVP live FX
  const bufferSize = 4096;
  processor = audioCtx.createScriptProcessor(bufferSize, 1, 2);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    // Push into ring buffer
    if (inputLen + input.length > INPUT_CAP) {
      // Drop oldest if overrun
      const drop = inputLen + input.length - INPUT_CAP;
      inputBuf.copyWithin(0, drop, inputLen);
      inputLen -= drop;
    }
    inputBuf.set(input, inputLen);
    inputLen += input.length;

    const outL = e.outputBuffer.getChannelData(0);
    const outR = e.outputBuffer.getChannelData(1);
    const frames = e.outputBuffer.length;
    const interleaved = new Float32Array(frames * 2);
    const got = filter.extract(interleaved, frames);

    for (let i = 0; i < frames; i++) {
      if (i < got) {
        outL[i] = interleaved[i * 2] || 0;
        outR[i] = interleaved[i * 2 + 1] || interleaved[i * 2] || 0;
      } else {
        outL[i] = 0;
        outR[i] = 0;
      }
    }
  };

  sourceNode.connect(processor);
  processor.connect(audioCtx.destination);

  console.info("[TrueHz] SoundTouch live capture @", sr, "ratio", ratio);
}

function stop() {
  try {
    processor?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    sourceNode?.disconnect();
  } catch {
    /* ignore */
  }
  try {
    mediaStream?.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  try {
    void audioCtx?.close();
  } catch {
    /* ignore */
  }
  processor = null;
  sourceNode = null;
  mediaStream = null;
  audioCtx = null;
  soundTouch = null;
  filter = null;
  inputLen = 0;
}
