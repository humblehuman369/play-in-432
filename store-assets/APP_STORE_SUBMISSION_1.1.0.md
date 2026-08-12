# App Store submission — Play In 432 v1.1.0 (build 12)

Copy/paste into App Store Connect. Addresses the **August 12, 2026** rejection of
build **11** (IAP not submitted + purchase error + UIBackgroundModes audio).

**Full fix guide:** `store-assets/REJECTION_RESOLUTION_1.1.0.md`

---

## What's New (version release notes)

New in 1.1.0

• Save a tuning to a track — choose 432 Hz (or any target) and it sticks to
  that song every time you play it.
• Library by frequency — filter your library by the tunings you've saved.
• Keep a retuned copy — render a track at your chosen frequency and save it
  right into your Library (Pro).
• Cleaner Player — the import box steps aside once you've added music, so
  playback and your queue lead.
• Accessibility and contrast improvements throughout.

---

## App Review Notes (Notes field)

Thanks for re-reviewing Play In 432 1.1.0 (build 12).

CHANGES SINCE BUILD 11
1. In-App Purchases: TrueHz Lite and TrueHz Pro (non-consumable only)
   are submitted with this version, with review screenshots. No
   subscriptions. Paid Apps Agreement is Active.
2. Purchase flow: native StoreKit via RevenueCat. Sandbox-tested Unlock
   Lite / Unlock Pro / Restore on device.
3. Guideline 2.5.4: removed UIBackgroundModes "audio". Playback is
   foreground Web Audio only; we do not claim persistent background audio.

HOW THE APP WORKS
Play In 432 retunes audio files the user already owns to A=432 Hz (and other
targets). Import any audio file (MP3/WAV/M4A/FLAC/OGG) via "Add music", then
tap a frequency. The app does not stream or bundle music — files stay on-device.

HOW TO TEST THE PURCHASE
1. Tap "Upgrade" (crown icon) — or tap any Pro-only frequency.
2. Choose "Unlock Pro" ($19.99) or "Unlock Lite" ($9.99). StoreKit sheet appears.
   Product IDs: com.playin432.app.truehz_lite · com.playin432.app.truehz_pro
3. Complete with a sandbox account. Restore Purchases is on the same sheet.
• Free path (no purchase): import a track and play at A=432.

PRIVACY
All audio and library data stay on-device. https://playin432.com/privacy.html

---

## IAP metadata (per product)

Both are Non-Consumable. Each needs an "App Review screenshot" — a screenshot
of the in-app upgrade screen showing the product (the Upgrade sheet with
"Unlock Pro — $19.99" / "Unlock Lite — $9.99" is sufficient).

TrueHz Lite — display name "TrueHz Lite"
  Description: All Solfeggio & custom frequency targets, plus 10 high-quality
  exports per month. One-time purchase, no subscription.

TrueHz Pro — display name "TrueHz Pro"
  Description: Every frequency target plus unlimited high-quality TrueHz Convert
  exports and batch export. One-time purchase, no subscription.

---

## Pre-submit checklist
- [ ] Paid Apps Agreement **Active** (Business) + banking/tax — do this FIRST
- [ ] No leftover subscription products in the RevenueCat **default** offering
- [ ] truehz_lite + truehz_pro: metadata complete, **App Review screenshot** on each
- [ ] Both IAPs **attached to version 1.1.0** (In-App Purchases and Subscriptions)
- [ ] `.env` has `VITE_REVENUECAT_IOS_API_KEY`; `npm run mobile:sync`; `appl_` present in ios public assets
- [ ] build **12** uploaded and attached to version 1.1.0
- [ ] Sandbox-tested Unlock Lite + Unlock Pro + Restore on a physical device
