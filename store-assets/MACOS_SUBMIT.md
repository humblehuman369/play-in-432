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
| Mac **binary / build** | **Not uploaded yet** |

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

## What’s blocking full submission

There is **no macOS binary** in this repo today (Capacitor targets are **iOS + Android only**). App Store Connect macOS 1.0 cannot be submitted until you attach a Mac build.

### Recommended path: Mac Catalyst

1. Open `ios/App/App.xcodeproj` in Xcode.  
2. Select target **App** → **General** → **Supported Destinations** → add **Mac (Designed for iPad)** *or* enable **Mac Catalyst** (Mac Catalyst gives a native Mac product for the Mac App Store listing).  
3. For a true **Mac App Store** product under platform **MAC_OS**:
   - Enable **Mac Catalyst** on the iOS target (or create a macOS destination).  
   - Set **Mac Catalyst** deployment target (e.g. macOS 13+).  
   - Signing: same Team `A2Y6C3NNSY`, bundle `com.playin432.app`.  
   - Capabilities: App Sandbox (required for Mac App Store).  
4. Product → **Archive** (destination: **Any Mac** / My Mac).  
5. Distribute → **App Store Connect** → Upload.  
6. In ASC → macOS 1.0 → select the processed build → Submit.

### Alternative (no separate Mac binary)

Enable **iPhone and iPad Apps on Apple Silicon Macs** availability for the **iOS** app (App Store Connect → Pricing and Availability → Apple Silicon Mac). That ships the iOS app on M‑series Macs without a MAC_OS version — different from filling the dedicated macOS 1.0 listing.

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
