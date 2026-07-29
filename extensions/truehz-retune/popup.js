/**
 * Phase 4 MVP popup — stores settings; starts/stops tab capture pipeline.
 * Full worklet processing lives in offscreen document (see background.js).
 */

const FREE_TARGETS = new Set([432, 440]);

function $(id) {
  return document.getElementById(id);
}

function updateRatio() {
  const s = Number($("sourceA").value) || 440;
  const t = Number($("targetA").value) || 432;
  const r = t / s;
  $("ratio").textContent = `Ratio: ${r.toFixed(6)} (${(1200 * Math.log2(r)).toFixed(1)} ¢)`;
}

async function load() {
  const stored = await chrome.storage.local.get({
    enabled: false,
    sourceA: 440,
    targetA: 432,
  });
  $("enabled").checked = stored.enabled;
  $("sourceA").value = stored.sourceA;
  $("targetA").value = stored.targetA;
  updateRatio();
  $("status").textContent = stored.enabled
    ? "On — capturing active tab audio"
    : "Off";
}

async function saveAndApply() {
  const sourceA = Number($("sourceA").value) || 440;
  const targetA = Number($("targetA").value) || 432;
  let enabled = $("enabled").checked;

  // Free tier: only 432/440 without unlock flag
  const { proUnlocked } = await chrome.storage.local.get({ proUnlocked: false });
  if (enabled && !FREE_TARGETS.has(targetA) && !proUnlocked) {
    $("status").textContent =
      "Target requires Lite/Pro — open playin432.com to unlock, then Restore.";
    $("enabled").checked = false;
    enabled = false;
  }

  await chrome.storage.local.set({ enabled, sourceA, targetA });
  updateRatio();

  try {
    const res = await chrome.runtime.sendMessage({
      type: "TRUEHZ_SET",
      enabled,
      sourceA,
      targetA,
    });
    $("status").textContent = res?.ok
      ? enabled
        ? "On — TrueHz active on tab"
        : "Off"
      : res?.error || "Could not start capture (focus a tab with audio).";
  } catch (e) {
    $("status").textContent =
      e instanceof Error ? e.message : "Background error";
  }
}

$("enabled").addEventListener("change", () => void saveAndApply());
$("sourceA").addEventListener("change", () => void saveAndApply());
$("targetA").addEventListener("change", () => void saveAndApply());

void load();
