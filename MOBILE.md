# Play In 432 — App Store & Google Play

Native shells are **Capacitor** wrappers around the same Vite/React app you ship on [playin432.com](https://playin432.com).

| Platform | Project | Bundle / Application ID |
|----------|---------|-------------------------|
| iOS | `ios/` | `com.playin432.app` |
| Android | `android/` | `com.playin432.app` |
| Display name | — | **Play In 432** |

## Prerequisites

### Accounts
- **Apple Developer Program** ($99/year) — [developer.apple.com](https://developer.apple.com)
- **Google Play Console** ($25 one-time) — [play.google.com/console](https://play.google.com/console)

### Mac tooling (this machine)
- Xcode (iOS Simulator + Archive)
- CocoaPods (`pod`)
- Android Studio + SDK (`~/Library/Android/sdk`)
- Node 20+

## Daily workflow

```bash
cd truehz-player

# After any web UI change:
npm run mobile:sync          # build dist + copy into ios/android

# Open native IDEs:
npm run mobile:ios           # Xcode
npm run mobile:android       # Android Studio

# Or run on device/simulator:
npm run mobile:run:ios
npm run mobile:run:android
```

## What works on device (same as web)

- Upload / library (IndexedDB)
- Live retune (SoundTouch) + TrueHz bed
- HQ export (Rubber Band WASM)
- Frequency targets + Free / Pro gates
- Stripe Checkout via **https://playin432.com** APIs (native cannot host serverless)
- Spotify OAuth (add mobile redirect URIs when you ship)

## Store checklist

### Branding assets (you still need these)
- App icon **1024×1024** (iOS) and adaptive icon (Android)
- Screenshots: 6.7" + 6.1" iPhone, 13" iPad optional; phone + 7" tablet Android
- Feature graphic 1024×500 (Play Store)
- Privacy policy URL: use playin432.com Learn / a dedicated `/privacy` page
- Support URL + contact email

### Apple App Store Connect
1. Create app → Bundle ID `com.playin432.app`
2. Xcode → Signing & Capabilities → your Team
3. **Product → Archive** → Distribute App
4. App Privacy: music files stay on device; Stripe / Spotify as applicable
5. Export compliance: `ITSAppUsesNonExemptEncryption = NO` (already in Info.plist)
6. Background Modes: **Audio** (for continued playback)

### Google Play Console
1. Create app → package `com.playin432.app`
2. Android Studio → **Build → Generate Signed App Bundle** (.aab)
3. Data safety form: files on-device; network for Stripe/Spotify only
4. Content rating questionnaire
5. Production track → rollout

## Stripe on mobile

Checkout sessions are created against **production**:

`POST https://playin432.com/api/create-checkout-session`

Success URL should eventually deep-link:

`playin432://?checkout=success&session_id=…`

Configure in Stripe + Apple **Associated Domains** / Android **App Links** when ready.  
Until then, users can complete Pro on the website; Pro is stored per-browser (native WebView has its own storage).

## Spotify (when testing OAuth on device)

Add redirect URIs in Spotify Dashboard, e.g.:

- `playin432://callback`
- `https://playin432.com/` (still)

And set `VITE_SPOTIFY_REDIRECT_URI` for native builds if needed.

## Versioning

Bump both:

- `package.json` → `version`
- iOS: Xcode target → Version / Build
- Android: `android/app/build.gradle` → `versionCode` / `versionName`

## Out of scope for v1 native

- Full rewrite in Swift/Kotlin  
- Offline-only Stripe without website  
- Equalizer (deferred)  
- Multi-device Pro license server (still device-local after verify)

## First launch target

1. `npm run mobile:sync`
2. `npm run mobile:ios` → run on Simulator
3. `npm run mobile:android` → run on emulator
4. Replace default Capacitor icons
5. Test: drop audio → retune → HQ export → Upgrade Pro (web API)
6. Submit TestFlight + Play internal testing
