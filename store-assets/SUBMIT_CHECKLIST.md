# App Store Submit Checklist — Play In 432 1.0 (Build 9)

**As of:** 2026-08-04
**App ID:** 6792840657
**Bundle:** `com.playin432.app`
**Web at:** commit `1d2927c` (all synced into native via `npx cap sync`)

## What changed since build 8

7 commits shipped to web/production since build 8; all are now synced into
the native app:

- **Security** — closed the public gift-email relay, generic API error
  responses, added security headers, metadata-authoritative purchase tiers
  (coupons can't downgrade a tier). *(SEC-1/2/3/5, CODE-5)*
- **Durable purchases** — Stripe webhook emails the buyer their unlock code
  even if they close the tab before the success screen; new post-purchase
  "You're unlocked" screen with copyable code; CORS locked to an allowlist.
  *(CODE-4, UX-5/6, SEC-4)*
- **Library storage overhaul** — IndexedDB schema **v2**: audio/artwork split
  out of the metadata store, with a one-time migration on first launch. Much
  lower memory on large libraries; playing a track no longer rewrites its
  audio. *(CODE-2/3)* ⚠️ **First launch of build 9 migrates each user's
  existing library — irreversible per device.**
- **Import polish** — cleaner track names (strips `_<hex>` suffixes), warns on
  exact duplicate imports. *(UX-4)*
- **Front-of-house** — two-card Lite/Pro upgrade screen, empty-state player,
  accessibility (aria-labels, keyboard playlist reorder, reduced-motion). *(UX-1/2/3)*
- **Spotify removed** — the Spotify connect/import integration is gone
  entirely (streaming audio is DRM-locked and can't be retuned). Replaced with
  a pointer to buy DRM-free downloads (iTunes Store / Amazon MP3 / Bandcamp)
  and import them. M3U playlist import stays. No OAuth, no Spotify SDK.
- **Landing polish** — centered the two start cards after the Spotify card was
  removed; fixed the AppIcon "unassigned child" asset-catalog warning.

## Native version this pass

- iOS `CURRENT_PROJECT_VERSION` = **9** · `MARKETING_VERSION` = **1.0.0**
- Android `versionCode` = **9** · `versionName` = **1.0.0**
- Web assets synced into `ios/App/App/public` and android assets.

## Carried over from build 8 (verify still true)

| Item | Status |
|------|--------|
| Web Stripe Lite / Pro / gift | Live (`cs_live_…` sessions) |
| Native pricing UI Free / Lite / Pro | In app |
| RevenueCat iOS public key in `.env` | Set |
| ASC IAP Lite `com.playin432.app.truehz_lite` | READY_TO_SUBMIT |
| ASC IAP Pro `com.playin432.app.truehz_pro` | READY_TO_SUBMIT |
| Privacy URL | https://playin432.com/privacy.html |
| `demoAccountRequired` | **false** |

## You must do (Xcode + App Store Connect — cannot be automated here)

### 1. Version-string decision (do this first)
- [ ] If **1.0 was already released** on the App Store, you cannot resubmit
      under 1.0 — create a **new version (e.g. 1.0.1)** in ASC and set
      `MARKETING_VERSION` to match before archiving.
- [ ] If **1.0 is still pending / was rejected**, build 9 can replace build 8
      under 1.0 (no marketing-version change needed).

### 2. Build & upload build 9
- [ ] `npm run mobile:ios` (opens Xcode on `ios/App/App.xcodeproj` — this
      project uses Swift Package Manager for Capacitor plugins, no `.xcworkspace`)
- [ ] Signing team set; destination = **Any iOS Device (arm64)**
- [ ] **Product → Archive → Distribute App → App Store Connect → Upload**
- [ ] Build **9** processes to **VALID** in ASC

### 3. Version 1.0 (or 1.0.1) content — re-confirm
- [ ] Screenshots present (6.7" / 6.1" / iPad if needed)
- [ ] Description, keywords, support URL, marketing URL
- [ ] Age rating + App Privacy questionnaire complete
- [ ] Export compliance (encryption) answered
- [ ] **What's New** notes filled in (draft below)
- [ ] Build **9** attached to the version

### 4. In-App Purchases
- [ ] Lite + Pro appear under the version's **In-App Purchases** (or submitted with the app)
- [ ] Localization + review screenshot if Apple requires it for the first IAP

### 5. Agreements
- [ ] Paid Apps Agreement **Active**; banking + tax complete

### 6. Sandbox test (recommended before submit)
- [ ] Sandbox Apple ID on device → Unlock Lite → Unlock Pro → Restore
- [ ] Import a track and confirm the **v2 library migration** works cleanly on
      a device that already has a build-8 library (the risky path)

### 7. Submit
- [ ] **Add for Review → Submit to App Review**

## What's New — App Store release-notes draft

> Faster, lighter library and a smoother upgrade experience:
> • Your music library now uses far less memory, especially with large collections.
> • Buy Lite or Pro and we email your unlock code, so you can restore on any device — even if you close the tab.
> • A clearer plan chooser, a friendlier first-run screen, and accessibility improvements (VoiceOver labels, keyboard playlist reordering, and reduced-motion support).
> • Import improvements: cleaner track names and a heads-up when you add a duplicate.

## Product notes for reviewers (already in ASC notes)

- No account / no demo login
- Free: import file → A=440→432
- No third-party streaming integration; retunes only files the user imports
- IAP: Lite + Pro non-consumables via StoreKit

⚠️ **Update the ASC reviewer notes** if they still mention Spotify — the
integration was removed in build 9.
