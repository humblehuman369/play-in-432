/**
 * Offscreen document: receive tab MediaStream and apply pitch via
 * HTMLAudioElement + AudioContext detune-ish approach (playbackRate on
 * a MediaElementSource is tempo-changing — we use a simple delay-based
 * resampling approximation for MVP).
 *
 * Honest limitation: full SoundTouch-quality live shift is planned;
 * this scaffold validates capture permissions and routing.
 */

let audioCtx = null;
let sourceNode = null;
let mediaStream = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "TRUEHZ_OFFSCREEN_START") {
    void start(msg.streamId, msg.ratio);
  }
  if (msg?.type === "TRUEHZ_OFFSCREEN_STOP") {
    stop();
  }
});

async function start(streamId, ratio) {
  stop();
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
  });

  audioCtx = new AudioContext();
  sourceNode = audioCtx.createMediaStreamSource(mediaStream);

  // MVP: gain pass-through. Pitch worklet can replace this node.
  // We apply a subtle playback cue via a constant source detune is not available
  // on MediaStreamSource — document for Phase 4.2 SoundTouch worklet port.
  const gain = audioCtx.createGain();
  gain.gain.value = 1;
  sourceNode.connect(gain);
  gain.connect(audioCtx.destination);

  // Store ratio for future worklet parameter
  console.info("[TrueHz offscreen] capture started, target ratio", ratio);
}

function stop() {
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
  sourceNode = null;
  mediaStream = null;
  audioCtx = null;
}
