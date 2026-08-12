# Mac App Store — Play In 432

**Platform:** macOS · **Version:** 1.0 · **Bundle:** `com.playin432.app`  
**ASC version id:** `b1fcae4e-8a43-455e-92fd-b1e51aea5120`

---

## What’s done in App Store Connect

| Requirement | Status |
|-------------|--------|
| Description, keywords, support/marketing URLs, promo text | Filled (en-US) |
| Copyright | `2026 Bradford Geisen / Rise In Harmony` |
| App Review contact + notes | Created |
| Desktop screenshots (APP_DESKTOP) | **5 × 2880×1800** uploaded |
| Local assets | `store-assets/screenshots/macos/` |
| Mac **binary / build** | **1.0 (1)** uploaded & attached (`662d0498-…`) |

Screenshots (order):

1. `01-hero` — Landing / free forever  
2. `02-frequencies` — Frequency targets  
3. `03-pricing` — Free / Lite / Pro  
4. `04-player` — Player empty state  
5. `05-learn` — Learn tab  

Also generated: `1440-*.png` (1440×900) for local use.

Privacy / support (same as iOS):

- Privacy: https://playin432.com/privacy.html  
- Support: https://playin432.com  

IAPs (shared with iOS):

- `com.playin432.app.truehz_lite` · $9.99  
- `com.playin432.app.truehz_pro` · $19.99  

---

## Native Mac app (shipped path)

Capacitor’s prebuilt XCFrameworks **do not include Mac Catalyst** slices, so Catalyst is not viable today.

Instead this repo ships a **native macOS WKWebView shell**:

| Path | Role |
|------|------|
| `macos/PlayIn432/` | Xcode project **PlayIn432** |
| Bundle ID | `com.playin432.app` (same app record as iOS) |
| Version | Marketing **1.0** · Build **1** |
| UI | Loads bundled `public/` (same Vite web UI as mobile) |
| Sandbox | App Sandbox + user-selected files + network client |

### Build / upload

```bash
# Sync web UI into iOS public (source for Mac Resources)
npm run mobile:sync
rm -rf macos/PlayIn432/PlayIn432/Resources/public
cp -R ios/App/App/public macos/PlayIn432/PlayIn432/Resources/public

cd macos/PlayIn432
xcodebuild -project PlayIn432.xcodeproj -scheme PlayIn432 \
  -destination 'generic/platform=macOS' -archivePath ../../store-assets/export/PlayIn432-macOS.xcarchive \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=A2Y6C3NNSY archive

# Then export/upload with ExportOptions (app-store-connect) + ASC API key
```

### Current ASC state

- Build **1.0 (1)** is **VALID** and **attached** to macOS version 1.0.  
- Listing metadata + 5 desktop screenshots are complete.  
- You can **Submit for Review** from App Store Connect when ready.

### Notes for reviewers / product

- Mac shell is WKWebView (web UI). StoreKit IAP on Mac may still need a native bridge for full in-app purchase parity with iOS; free listening works without purchase.  
- Prefer testing import + retune + play on a Mac before submit.

---

## Regenerating screenshots

```bash
cd play-in-432
npm run build
npx vite preview --host 127.0.0.1 --port 4173
# other terminal:
npx playwright install chromium   # once
# then re-run the capture script (or ask the agent to regenerate)
```

Sizes accepted for **APP_DESKTOP**: 1280×800, 1440×900, 2560×1600, **2880×1800** (we use 2880×1800).

---

## Pre-submit checklist (Mac)

- [x] Listing copy (description, keywords, URLs)  
- [x] Screenshots (5 desktop)  
- [x] Review notes + contact  
- [x] Copyright  
- [ ] Mac archive uploaded & VALID  
- [ ] Build attached to macOS 1.0  
- [ ] Export compliance / encryption answered for Mac if prompted  
- [ ] Sandbox-test IAP on Mac if shipping StoreKit  
- [ ] Submit for Review  

---

## App Review notes (already in ASC)

See App Store Connect → macOS 1.0 → App Review Information. Summary: no login; free 432 path; IAP Lite/Pro product IDs; on-device audio only.
