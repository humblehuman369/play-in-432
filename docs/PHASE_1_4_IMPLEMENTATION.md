# Phases 1–4 implementation notes

Shipped in codebase (July 2026). Aligns with *Play In 432 — 7-Phase Product Development Plan* with the pragmatic decisions below.

## Decisions taken

| Topic | Choice |
|-------|--------|
| Tiers | Free · Lite ($9.99) · Pro ($19) one-time |
| Identity | Still **no account**; restore via Stripe email / session (gift) code or App Store Restore |
| Lite HQ cap | 10 / calendar month (device-local counter) |
| Free HQ cap | 3 lifetime (unchanged) |
| Gifts | Stripe Checkout + session id as redeem code (no email ESP required for v1) |
| Batch export | **Pro only** |
| Share demos | Built-in synthesized clips only (no user library upload) |
| Extension | MV3 scaffold; live pitch quality still TODO |

## Phase 1 — Pricing

- `src/lib/tiers.ts` — tier model
- `src/lib/pro.ts` — free/lite/pro state, gates, checkout options
- `api/create-checkout-session.js` — `tier` + `gift` metadata
- `api/verify-checkout-session.js` / `restore-pro.js` — return `tier`
- `PricingSection` — 3 cards + gift + restore

### Ops you must do

1. Optional Stripe Price IDs: `STRIPE_LITE_PRICE_ID`, existing `STRIPE_PRICE_ID`
2. App Store / RevenueCat: add Lite SKU when ready (`com.playin432.app.truehz_lite`)
3. Finish RevenueCat IAP key so products validate

## Phase 2 — Batch export

- `src/components/BatchExportPanel.tsx` on Player tab
- Sequential Rubber Band / SoundTouch path, WAV|MP3, ZIP via `fflate`

## Phase 3 — Share demos

- `src/components/ShareDemoView.tsx`
- Tab **Share** + public URL `?share=1&clip=piano&hz=432`
- Motifs are synthesized (no PD audio files required for v1)

## Phase 4 — Extension

- `extensions/truehz-retune/` — load unpacked in Chrome
- Capture + offscreen wired; **SoundTouch worklet pitch still TODO** (see extension README)

## Deploy

```bash
# Web
git push origin main   # Vercel

# Mobile webview
npm run mobile:sync
```
