# App Store submission — Play In 432 v1.1.0 (build 11)

Copy/paste into App Store Connect. Addresses the Guideline 2.1(b) rejection of
build 10 (IAP hang + un-submitted subscription products).

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

Thanks for reviewing Play In 432.

No account or login is required — the app works immediately on launch.

HOW THE APP WORKS
Play In 432 retunes audio files the user already owns to A=432 Hz (and other
targets). To try it, import any audio file (MP3/WAV/M4A/FLAC/OGG) via the
"Add music" button or drag-and-drop, then tap a frequency to hear it retuned.
The app does not stream, sell, or bundle any music — all files are provided by
the user and never leave the device.

IN-APP PURCHASES (please note the changes since build 10)
• There are NO subscriptions. The auto-renewable monthly/yearly products
  referenced in the previous build have been REMOVED from this binary.
• Two one-time, non-consumable unlocks remain:
    – TrueHz Lite  (com.playin432.app.truehz_lite,  $9.99)
    – TrueHz Pro   (com.playin432.app.truehz_pro,  $19.99)
• Both IAP products are submitted for review with this version, and the Paid
  Apps Agreement is active.

HOW TO TEST THE PURCHASE (the flow that failed previously)
1. Tap "Upgrade" (crown icon, top-right) — or tap any Pro-only frequency.
2. Choose "Unlock Pro" or "Unlock Lite". The StoreKit purchase sheet appears.
3. Complete with a sandbox account. Purchase unlocks all frequency targets and
   unlimited high-quality export on this device.
• "Restore Purchases" is available in the same sheet.
• The previous "indefinite loading" was a fallback that has been removed; if a
  product is ever unavailable the app now shows a clear message instead of
  hanging.

PRIVACY
All audio and library data stay on-device (IndexedDB). No user files are
uploaded to any server.

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
- [ ] Paid Apps Agreement signed (Business section) — do this FIRST
- [ ] monthly/yearly products deleted from App Store Connect + RevenueCat offering
- [ ] truehz_lite + truehz_pro in "Ready to Submit", App Review screenshot attached
- [ ] build 11 uploaded and attached to version 1.1.0
- [ ] Sandbox-tested the Unlock Pro flow (StoreKit sheet appears, unlock works)
