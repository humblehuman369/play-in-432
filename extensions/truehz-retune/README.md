# TrueHz™ Browser Extension (Phase 4)

Chrome / Brave / Edge **Manifest V3** scaffold for real-time tab audio retune.

## Status (MVP scaffold)

| Piece | Status |
|-------|--------|
| Popup UI (source/target, disclaimer) | Done |
| Free 440→432 gating hook | Done |
| Tab capture + offscreen document | Wired |
| Live pitch (SoundTouch, tempo preserved) | Done (ScriptProcessor path) |
| Chrome Web Store listing assets | TODO |

## Load unpacked (dev)

1. Open `chrome://extensions` → Developer mode  
2. **Load unpacked** → select this folder: `extensions/truehz-retune`  
3. Open a tab with audio, open the popup, enable **Retune active**

## Honest disclosure

The popup states that this shifts **browser audio output** by a ratio and does **not** modify streaming masters.

## Pro unlock

`chrome.storage.local.proUnlocked` can be set after a future bridge from playin432.com. Until then, non-432/440 targets show a message to unlock on the site.

## Next engineering steps

1. Migrate ScriptProcessor → AudioWorklet for lower latency / future-proofing.  
2. Measure latency on Spotify Web / YouTube; document DRM failures.  
3. Bridge Lite/Pro unlock from playin432.com → `chrome.storage.local.proUnlocked`.  
4. Package icons (128/48/16) and Chrome Web Store listing.
