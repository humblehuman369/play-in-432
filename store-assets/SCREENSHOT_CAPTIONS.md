# App Store screenshot captions — Play In 432

On-image text for marketing screenshots. Use the same copy for **iPhone 6.7"** and **6.1"**.

**Assets:** `screenshots/iphone-6.7/` · `screenshots/iphone-6.1/`  
**Brand:** background `#070B0F` · accent `#00D4AA` · text `#E8F7F3` · muted `#8AA8A0`

---

## Canvas sizes

| Device | Size (px) |
|--------|-----------|
| iPhone 6.7" | 1290 × 2796 |
| iPhone 6.1" | 1179 × 2556 |

Export PNG, sRGB.

---

## Safe zones (% of frame)

| Zone | Keep clear |
|------|------------|
| Top **8%** | Status / Dynamic Island |
| Bottom **12%** | Home indicator / store chrome |
| Left / right **6%** | Rounded corners |
| Caption band **Y 10–28%** | Headline + subline |
| UI showcase **Y 28–88%** | Device / app UI |
| Optional footer **Y 88–94%** | Trust badge |

---

## Type system

| Element | Weight | 6.7" size | 6.1" size | Color |
|---------|--------|-----------|-----------|--------|
| Headline | Bold / Semibold | 64–72 px | 56–64 px | `#E8F7F3` |
| Subline | Medium / Regular | 32–36 px | 28–32 px | `#8AA8A0` |
| Badge | Semibold | 22–26 px | 20–24 px | `#070B0F` on `#00D4AA` pill |

- Headline: max 2 lines (prefer 1); line-height ~1.05–1.1  
- Subline: max 2 lines; line-height ~1.25  
- Font: SF Pro, Inter, or Helvetica Neue  

---

## Device placement

- Width ≈ **78–84%** of canvas  
- Horizontally centered  
- Soft shadow: Y 40, blur 80, black 40%  
- Optional top scrim if UI is busy: black 0→55% over top 35%  

---

## Captions (primary set)

| # | Suggested file | Headline | Subline | Optional badge |
|---|----------------|----------|---------|----------------|
| 01 | `01-hero` | Your music. Retuned to 432. | Live A=440 to A=432 with TrueHz | Private · On-device |
| 02 | `02-frequencies` | One-tap frequency targets | 432 free · more with Pro | — |
| 03 | `04-player` or player UI | Hear the difference live | Original vs Retune · TrueHz bed | — |
| 04 | `03-pricing` or export | Keep it — HQ WAV export | TrueHz Convert · Pro unlocks all | One-time Pro |
| 05 | `05-learn` | Honest science. No hype. | Files never leave your device | — |

Match caption to **what is on screen**. If `03` is pricing and `04` is player, swap rows 03/04.

### Conversion order (first 3 matter most)

1. Promise (432)  
2. Control (frequencies)  
3. Proof (live A/B)  
4. Value (HQ + Pro)  
5. Trust (honest + private)  

---

## Ultra-short (huge type only)

```
01  Retune to 432 — live
02  One-tap frequency targets
03  Original vs Retune
04  HQ WAV with TrueHz
05  Private. On-device.
```

---

## Copy-paste pack

```
01  Your music. Retuned to 432.
    Live A=440 to A=432 with TrueHz

02  One-tap frequency targets
    432 free · more with Pro

03  Hear the difference live
    Original vs Retune · TrueHz bed

04  Keep it — HQ WAV export
    TrueHz Convert · Pro unlocks all

05  Honest science. No hype.
    Files never leave your device
```

---

## Canva

1. Custom size 1290×2796 (duplicate set at 1179×2556)  
2. Background `#070B0F`  
3. App screenshot ~80% width, centered  
4. Headline ~68 px / subline ~34 px on 6.7"; ~88% scale on 6.1"  
5. Export PNG  

## Figma

1. Frame `iPhone 6.7 Marketing` 1290×2796  
2. Components: `Caption/Headline`, `Caption/Subline`, `Badge/Teal`  
3. Variants `Frame=01…05`  
4. Export exact pixel sizes above  

---

## Upload checklist

- [ ] 5 frames composited for 6.7"  
- [ ] 5 frames composited for 6.1"  
- [ ] First three sell: 432 / live retune / private  
- [ ] Replace App Store Connect en-US screenshots  
- [ ] Pair with build **1.0.0 (3)** (or current shipping build)  
