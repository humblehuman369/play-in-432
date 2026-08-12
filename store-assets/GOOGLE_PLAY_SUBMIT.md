# Google Play — Submit Play In 432 (first release)

> **Fill-out pack (use this first):**  
> **[google-play/PLAY_CONSOLE_FILL_SHEET.md](./google-play/PLAY_CONSOLE_FILL_SHEET.md)** — every Play Console field pre-answered for copy/paste.  
> Assets + AAB live in **`store-assets/google-play/`**.

**Package name:** `com.playin432.app`  
**Version:** 1.1.0 · **versionCode:** 11  
**Signed AAB (ready to upload):**

```
store-assets/google-play/play-in-432-1.1.0-vc11.aab
```

Also built at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

> **Important:** Nobody outside your Google account can complete Play Console
> submission. This doc + AAB get you to the last mile. You must click through
> Play Console yourself (identity, payments, declarations, Submit).

---

## 0. Before you open Play Console

### Backup the upload keystore (do this now)

| Item | Path |
|------|------|
| Keystore | `.secrets/playin432-upload.jks` |
| Passwords + alias | `.secrets/UPLOAD_KEY_BACKUP.txt` |
| PEM cert (optional) | `.secrets/playin432-upload.pem` |
| Gradle props | `.secrets/key.properties` |

Copy the entire `.secrets/` folder to a password manager and/or encrypted drive.
If you lose the upload key after enrolling Play App Signing, you must request
an upload-key reset from Google (days of delay).

`.secrets/` is gitignored — never commit it.

### Rebuild later (same machine)

```bash
cd play-in-432
export JAVA_HOME="$HOME/.jdks/jdk-21.0.12+8/Contents/Home"   # or any JDK 17/21
export ANDROID_HOME="$HOME/Library/Android/sdk"
npm run mobile:sync
cd android && ./gradlew bundleRelease
```

---

## 1. Create the app

1. Open [Google Play Console](https://play.google.com/console) and sign in with
   your developer account.
2. **Create app**
   - **App name:** Play In 432  
   - **Default language:** English (United States)  
   - **App or game:** App  
   - **Free or paid:** Free (in-app unlocks for Lite/Pro)  
3. Accept declarations (Developer Program Policies, US export laws, etc.).

---

## 2. Dashboard checklist (complete each section)

Play requires these before production review:

| Section | What to enter |
|---------|----------------|
| **App access** | All functionality available without login. No demo account. |
| **Ads** | No ads |
| **Content rating** | Start questionnaire → category **Music & Audio** / Utility. Answer honestly (no violence, no user-generated chat, etc.). Expect **Everyone** / PEGI 3-ish. |
| **Target audience** | 18+ (or 13+ if you prefer; no child-directed features) |
| **News app** | No |
| **COVID-19** | No |
| **Data safety** | See §4 below |
| **Government apps** | No |
| **Financial features** | No (IAP for digital unlock only) |
| **Health** | No medical claims — retune is pitch shift, not therapy |
| **Store listing** | §3 |
| **Countries** | All countries (or your choice) |
| **App category** | Music & Audio |
| **Contact details** | Support email + https://playin432.com |
| **Privacy policy** | `https://playin432.com/privacy.html` |

---

## 3. Store listing (copy/paste)

### Short description (≤80 characters)

```
Retune your music to 432 Hz with TrueHz — private, on-device, no account.
```

### Full description

```
Play In 432 is a private music player that retunes files you already own for 432 Hz listening - powered by TrueHz technology.

YOUR MUSIC, ON YOUR DEVICE
- Import MP3, WAV, FLAC, M4A, OGG and more
- Library and playlists stay on your device
- No account required to listen
- Your audio is never uploaded for playback

TRUEHZ RETUNE
- Live retune A=440 to A=432 (and more with Pro)
- Optional TrueHz pure-tone bed at the target frequency
- Frequency strip with Re-anchor or Concert A modes
- Learn tab with honest science - no fake healing claims

HQ EXPORT (TrueHz Convert)
- High-quality offline WAV export
- Free tier includes limited HQ exports
- Pro unlocks unlimited TrueHz Convert downloads

TRUEHZ PRO
- All Solfeggio and custom frequency targets
- Unlimited HQ exports
- One-time unlock options (see in-app) - no subscription required for core 432 listening

Play In 432 is part of the Rise In Harmony family.
https://playin432.com
https://playin432.com/privacy.html
```

### Graphics

| Asset | File | Spec |
|-------|------|------|
| **App icon** | Adaptive icons already in `android/app/src/main/res/mipmap-*` (in AAB). High-res: `assets/app-icon/AppIcon-1024.png` or `public/icons/icon-512.png` | 512×512 PNG for Play listing |
| **Feature graphic** | `store-assets/play-feature-graphic.png` | 1024×500 ✓ ready |
| **Phone screenshots** | `store-assets/screenshots/iphone-6.7/*.png` (5 shots) | 1290×2796 — upload as phone screenshots (min 2) |
| Optional tablet | `store-assets/screenshots/ipad-pro-12.9/*.png` | Optional |

**App name (listing):** Play In 432  
**App category:** Music & Audio  
**Tags (optional):** music player, audio, tools  
**Website:** https://playin432.com  
**Email:** your support address  
**Privacy policy:** https://playin432.com/privacy.html  

---

## 4. Data safety form (recommended answers)

Music files stay on-device (IndexedDB / WebView storage). Network is used for
Stripe/RevenueCat checkout and optional analytics only if you enable them.

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | **Yes** (purchase / device identifiers via Play Billing & RevenueCat) |
| Location | No |
| Personal info (name, email) | **Optional** — only if user enters email for unlock-code restore / gift |
| Financial info | Purchase history via Google Play (declared as handled by Play) |
| Photos/videos | No |
| Audio files | **Collected, not shared** — processed on device for playback/export; not uploaded |
| Files and docs | Same as audio if declared |
| App activity | Optional: product interaction if you use analytics (default: no custom analytics) |
| App info and performance | Crash logs: only if you add Crashlytics later (currently none) |
| Device or other IDs | **Yes** — Play Billing / RevenueCat may use advertising or app-set IDs for purchase restore |
| Data encrypted in transit | Yes (HTTPS) |
| Users can request deletion | Yes — uninstall clears on-device library; contact support for account-linked purchase records |
| Children | Not directed at children |

Tune answers to match what you actually ship. When in doubt, open Privacy Policy
and mirror it.

---

## 5. Monetization & IAP (Play Billing)

Native unlocks use **RevenueCat + Google Play Billing** (not Stripe in-app).

### 5a. Play Console products

1. **Monetize → Products → In-app products → Create product**

| Product ID | Name | Price (USD) | Type |
|------------|------|-------------|------|
| `com.playin432.app.truehz_lite` | TrueHz Lite | $9.99 | One-time |
| `com.playin432.app.truehz_pro` | TrueHz Pro | $19.99 | One-time |

2. Activate both products.
3. Complete **Payments profile** + tax if not already done (required to sell).

### 5b. RevenueCat Android app

1. [app.revenuecat.com](https://app.revenuecat.com) → Play In 432 project  
2. Add **Android** app with package `com.playin432.app`  
3. Link Google Play service credentials (JSON key from Google Cloud with
   Play Developer API access) — RevenueCat docs: *Connect Google Play Store*  
4. Create/link same product IDs; map to entitlements `truehz_lite` / `truehz_pro`  
5. Put the **Google public SDK key** (`goog_…`) in env as  
   `VITE_REVENUECAT_ANDROID_API_KEY` and rebuild/sync if not already baked in.

Without Play products + RevenueCat Android wiring, free retune still works;
**in-app Lite/Pro purchase will fail** until this is done.

---

## 6. Upload the AAB

1. Play Console → your app → **Release → Production**  
   (or start with **Internal testing** / **Closed testing** — recommended first)  
2. **Create new release**  
3. Upload:

   ```
   store-assets/google-play/play-in-432-1.1.0-vc11.aab
   ```

4. First upload: enroll **Play App Signing** (accept Google managing the app
   signing key). Your `.jks` is the **upload key** only.  
5. **Release name:** `1.1.0 (11)`  
6. **Release notes (en-US):**

```
First Android release of Play In 432.
• Import your music and retune A=440 → A=432 with TrueHz
• Optional pure-tone bed and frequency targets
• HQ WAV export (TrueHz Convert)
• Private on-device library — no account required to listen
```

7. Save → **Review release** → roll out (Internal first is safest).

---

## 7. Recommended path: Internal testing first

1. **Release → Testing → Internal testing → Create release**  
2. Upload the same AAB  
3. Add testers (email list or Google Group)  
4. Install via the opt-in link on an Android device  
5. Smoke-test:
   - Launch, import a short MP3/WAV  
   - Toggle Original / Retune 432  
   - HQ export (if free quota allows)  
   - Lite/Pro purchase with a **license test account**  
     (Play Console → Settings → License testing)  
6. Then promote to **Closed** or **Production**.

---

## 8. Submit for production review

When dashboard shows all green:

1. Production release → **Send for review** / **Start rollout to Production**  
2. Review often takes **a few days** for a first app  
3. Watch email for policy questions (common: privacy, IAP, misleading claims)

### Reviewer notes (paste into “Notes for reviewers”)

```
Play In 432 retunes audio files the user imports (pitch shift, e.g. A=440→A=432).
No account or login is required for free 432 listening.
Music stays on the device; we do not upload audio for playback.
Optional TrueHz Lite / Pro are one-time Play Billing unlocks (not subscriptions).
No medical or healing claims — Learn tab explains the math honestly.
Privacy: https://playin432.com/privacy.html
Support: https://playin432.com
```

---

## 9. Versioning for the next release

Bump **both** before the next AAB:

| Place | Field |
|-------|--------|
| `package.json` | `version` |
| `android/app/build.gradle` | `versionCode` (integer, always +1) and `versionName` |

Then:

```bash
npm run mobile:sync
cd android && ./gradlew bundleRelease
```

---

## 10. What was prepared for you on this machine

| Item | Status |
|------|--------|
| Capacitor Android project `com.playin432.app` | ✓ |
| Web assets synced into Android (v1.1.0) | ✓ |
| Upload keystore + signing in `app/build.gradle` | ✓ |
| Signed release AAB (versionCode 11) | ✓ |
| Feature graphic 1024×500 | ✓ |
| Phone screenshots (from iOS 6.7") | ✓ |
| Privacy policy URL live | ✓ |
| Store listing copy | ✓ |
| Play Console create + click Submit | **You** |
| Play IAP products + RevenueCat Google link | **You** |
| Content rating / data safety / declarations | **You** |

---

## Quick links

- Play Console: https://play.google.com/console  
- Privacy: https://playin432.com/privacy.html  
- Website: https://playin432.com  
- App Store (iOS twin): ASC app 6792840657 · same package family `com.playin432.app`  
- Repo guide: `MOBILE.md`  
