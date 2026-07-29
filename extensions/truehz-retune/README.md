# TrueHz™ Browser Extension (Phase 4)

Chrome / Brave / Edge **Manifest V3** scaffold for real-time tab audio retune.

## Status (MVP scaffold)

| Piece | Status |
|-------|--------|
| Popup UI (source/target, disclaimer) | Done |
| Free 440→432 gating hook | Done |
| Tab capture + offscreen document | Wired |
| High-quality live pitch (SoundTouch/Worklet) | **TODO Phase 4.2** |
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

1. Port SoundTouch or a WASM pitch shifter into `offscreen.js` as an AudioWorklet.  
2. Preserve tempo (pitch without rate change).  
3. Measure latency on Spotify Web / YouTube.  
4. Package icons (128/48/16) and store listing.
