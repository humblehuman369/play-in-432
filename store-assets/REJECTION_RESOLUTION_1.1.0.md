# App Store rejection resolution — v1.1.0 → build **12**

**Submission rejected:** 2026-08-12 · Review device iPad Air 11" (M3) · Version **1.1.0 (11)**  
**Submission ID:** `867081cd-5fb8-4630-bba5-ec240e9d316e`

Apple raised **three** issues. Two are App Store Connect / agreement (not pure code). One is a plist fix already applied in this repo.

---

## Summary of fixes

| Guideline | Issue | Fix |
|-----------|--------|-----|
| **2.1(b)** | IAP products not submitted for review | Submit both non-consumables **with the next binary**, including App Review screenshots |
| **2.1(b)** | Error message on purchase | Ensure RevenueCat key is **baked into the binary**, products load in sandbox, Paid Apps Agreement **Active**, then sandbox-test Unlock Pro/Lite |
| **2.5.4** | `UIBackgroundModes` = `audio` with no persistent audio | **Removed** `audio` from `Info.plist` (build 12) |

Code changes in this pass:
- `ios/App/App/Info.plist` — removed background `audio` mode
- `src/lib/revenueCat.ts` — clearer purchase / product-missing errors (no hang)
- Build number **12** (iOS `CURRENT_PROJECT_VERSION`, Android `versionCode`)
- Local `.env` with `VITE_REVENUECAT_IOS_API_KEY=appl_…` required before `npm run mobile:sync`

---

## 1. Guideline 2.1(b) — Submit In-App Purchase products

Products the app expects (must match exactly):

| Product ID | Type | Price (USA) | Display name |
|------------|------|-------------|--------------|
| `com.playin432.app.truehz_lite` | Non-Consumable | $9.99 | TrueHz Lite |
| `com.playin432.app.truehz_pro` | Non-Consumable | $19.99 | TrueHz Pro |

### In App Store Connect

1. Open **Play In 432** → **Monetization → In-App Purchases**.
2. For **each** product above, open it and confirm status is not **Missing Metadata**:
   - Reference name + localization (English)
   - Price tier
   - **Review Screenshot** (required before first submission)  
     Use any clear shot of the upgrade UI showing Lite/Pro, e.g.:
     - `store-assets/screenshots/iphone-6.7/03-pricing.png`
     - or `store-assets/iap-review-screenshot.png` if present
3. Open version **1.1.0** (or create **1.1.1** if needed).
4. Under **In-App Purchases and Subscriptions**, click **+** and **attach both** products to this version.
5. Do **not** leave products only as “Ready to Submit” without attaching them to the version you submit — that is exactly what Apple’s first note describes.

### Metadata copy (paste if empty)

**TrueHz Lite**  
> All Solfeggio & custom frequency targets, plus 10 high-quality exports per month. One-time purchase, no subscription.

**TrueHz Pro**  
> Every frequency target plus unlimited high-quality TrueHz Convert exports and batch export. One-time purchase, no subscription.

### Paid Apps Agreement (required for IAP to work in review)

1. App Store Connect → **Business** (or **Agreements, Tax, and Banking**).
2. **Paid Apps** agreement must be **Active** (not “Pending User Info”).
3. Banking + tax forms complete for the Account Holder.

Without an Active Paid Apps Agreement, sandbox/review purchases often show a generic error — matching Apple’s second note.

---

## 2. Guideline 2.1(b) — Purchase error on device

Apple saw an **error when tapping purchase**. Common causes for this app:

1. **Binary built without** `VITE_REVENUECAT_IOS_API_KEY` → RevenueCat never configures → purchase errors.
2. IAP products incomplete / not linked / Paid Apps Agreement inactive.
3. RevenueCat dashboard not wired to App Store (IAP `.p8` key) or offering empty.

### Rebuild checklist (do this on the Mac that archives)

```bash
cd /path/to/play-in-432

# 1) Public iOS SDK key must exist (never commit .env)
#    From RevenueCat → Project → API keys → Apple public key (appl_…)
grep VITE_REVENUECAT_IOS_API_KEY .env

# 2) Web build + copy into ios/ (bakes the key into JS assets)
npm run mobile:sync

# 3) Confirm key is inside the native web assets
rg -c "appl_" ios/App/App/public/assets/*.js
# Expect at least one hit. Zero hits = do NOT archive.

# 4) Open Xcode, archive build 12
npm run mobile:ios
# Product → Archive → Distribute → App Store Connect
```

### RevenueCat dashboard (one-time)

| Item | Value |
|------|--------|
| iOS app bundle | `com.playin432.app` |
| Entitlements | `truehz_lite`, `truehz_pro` |
| Offering | `default` (Current) |
| Packages | `lite` → Lite product, `lifetime` → Pro product |
| App Store Connect API / IAP key | Uploaded on the iOS app in RevenueCat |

Full detail: `store-assets/REVENUECAT.md` and `store-assets/IAP_PRODUCTS.md`.

### Sandbox test before resubmit (mandatory)

1. App Store Connect → **Users and Access → Sandbox → Testers** → create a tester.
2. On a physical iPhone/iPad: **Settings → Developer / App Store → Sandbox Account** (sign in with tester).
3. Install the **new** build (TestFlight internal or Xcode).
4. Tap **Unlock Pro** and **Unlock Lite** — StoreKit sheet must appear; complete purchase.
5. Confirm unlock works; force-quit; **Restore Purchases**.

If you still get an error in sandbox, fix that **before** resubmitting — review uses the same IAP sandbox path.

---

## 3. Guideline 2.5.4 — Background audio

**Done in code (build 12):** removed

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

from `ios/App/App/Info.plist`.

**Why:** The app retunes and plays with the **Web Audio API** while active. It does not implement native `AVAudioSession` background playback (music player / streaming). Declaring `audio` without a real persistent-audio feature is what Apple flagged.

**Optional later:** If you add lock-screen / background playback, reintroduce `audio`, configure `AVAudioSession` category `.playback`, prove it on a device, and attach a **screen recording** (play → Home → audio continues) in App Review notes.

---

## 4. App Review notes (paste into ASC)

```
Thanks for re-reviewing Play In 432 1.1.0 (build 12).

CHANGES SINCE BUILD 11
1. In-App Purchases: TrueHz Lite and TrueHz Pro (non-consumable only)
   are submitted with this version, with review screenshots. No
   subscriptions. Paid Apps Agreement is Active.
2. Purchase flow: native StoreKit via RevenueCat. Sandbox-tested Unlock
   Lite / Unlock Pro / Restore on device.
3. Guideline 2.5.4: removed UIBackgroundModes "audio". Playback is
   foreground Web Audio only; we do not claim persistent background audio.

HOW TO TEST
• No login required.
• Free path: Add music → play at A=432 — works without purchase.
• IAP: crown / Upgrade → Unlock Lite ($9.99) or Unlock Pro ($19.99).
  Product IDs:
    com.playin432.app.truehz_lite
    com.playin432.app.truehz_pro
• Restore Purchases is on the same sheet.

All user audio stays on-device. Privacy: https://playin432.com/privacy.html
```

---

## 5. Resubmit order of operations

1. [ ] Paid Apps Agreement **Active** + banking/tax complete  
2. [ ] Both IAP products complete (localization + **review screenshot**)  
3. [ ] `.env` has `VITE_REVENUECAT_IOS_API_KEY`  
4. [ ] `npm run mobile:sync` → `rg` confirms `appl_` in `ios/.../public/assets`  
5. [ ] Archive & upload **build 12**  
6. [ ] Attach build 12 + **both IAPs** to version 1.1.0  
7. [ ] Sandbox purchase works on a real device  
8. [ ] Paste App Review notes above  
9. [ ] Submit for Review  

---

## Product IDs quick reference

```
com.playin432.app.truehz_lite   Non-Consumable   $9.99
com.playin432.app.truehz_pro    Non-Consumable   $19.99
```

No monthly/yearly subscriptions in this binary.
