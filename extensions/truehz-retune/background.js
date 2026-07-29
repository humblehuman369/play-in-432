/**
 * Service worker — coordinates tab capture + offscreen AudioContext pitch shift.
 * Phase 4 scaffold: capture path is wired; pitch uses playbackRate-style
 * detune via AudioContext if SoundTouch is unavailable in SW.
 *
 * Note: Real-time high-quality Rubber Band is not used here (too heavy for
 * live tab audio). Ratio math matches the web app (concert A style).
 */

let activeStreamId = null;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "TRUEHZ_SET") {
    void handleSet(msg)
      .then((r) => sendResponse(r))
      .catch((e) =>
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    return true;
  }
  return false;
});

async function handleSet({ enabled, sourceA, targetA }) {
  if (!enabled) {
    await stopCapture();
    return { ok: true };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return { ok: false, error: "No active tab." };
  }

  await ensureOffscreen();

  // Prefer tabCapture API
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId(
      { targetTabId: tab.id },
      (id) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(id);
      },
    );
  });

  activeStreamId = streamId;
  const ratio = (Number(targetA) || 432) / (Number(sourceA) || 440);

  await chrome.runtime.sendMessage({
    type: "TRUEHZ_OFFSCREEN_START",
    streamId,
    ratio,
  });

  return { ok: true };
}

async function stopCapture() {
  activeStreamId = null;
  try {
    await chrome.runtime.sendMessage({ type: "TRUEHZ_OFFSCREEN_STOP" });
  } catch {
    /* offscreen may not exist */
  }
}

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existing?.length) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["USER_MEDIA"],
    justification: "Process captured tab audio for TrueHz pitch shift",
  });
}
