# Play In 432 — Website Walkthrough Video

**File:** `PlayIn432-Website-Walkthrough.mp4`  
**Length:** ~51 seconds · **1920×1080** · H.264  
**Source:** Live captures from https://playin432.com/ (Aug 2026)

## What it is

A short captioned walkthrough for social, decks, or as a visual bed under live narration.  
Scene order follows `store-assets/LIVE_WALKTHROUGH_SCRIPT.md` (short version).

| # | Scene | Caption |
|---|--------|---------|
| 0 | Title | Play In 432 · Website walkthrough |
| 1 | Hero | Your music, retuned to 432 |
| 2 | Start cards | Files · Spotify match · Playlist import |
| 3 | Trust | Listeners who want the truth |
| 4 | Frequencies | Free 440→432 · more with Lite/Pro |
| 5 | Features | Live retune · library · TrueHz Convert |
| 6 | Differentiation | Not fake Spotify streaming retune |
| 7 | Hear the difference | Pure-tone ratio demo section |
| 8 | Pricing | Free · Lite · Pro |
| 9 | FAQ | Honest answers |
| 10 | Player | Free 432, no sign-up |
| 11 | Final CTA | playin432.com |
| 12 | Outro | Your music. Retuned to 432. |

## How to regenerate

```bash
cd truehz-player
# 1) Capture frames from live site (requires Brave Browser)
node scripts/capture-walkthrough.mjs

# 2) Build captioned MP4 (requires ffmpeg + Pillow)
python3 scripts/build-walkthrough-video.py
```

## Live narration

Use with `LIVE_WALKTHROUGH_SCRIPT.md`. This video is silent — speak over it, or record a separate voiceover and mux:

```bash
ffmpeg -i PlayIn432-Website-Walkthrough.mp4 -i voiceover.m4a \
  -c:v copy -c:a aac -shortest PlayIn432-Website-Walkthrough-VO.mp4
```

## Note

This is a **screenshot walkthrough**, not a full interactive screen recording with audio playback. For a full “add a file and listen” demo, record the browser live with the script.
