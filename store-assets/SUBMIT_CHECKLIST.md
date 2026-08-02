# App Store Submit Checklist — Play In 432 1.0

**As of:** 2026-08-02  
**App ID:** 6792840657  
**Bundle:** `com.playin432.app`

## Automated (done by tooling)

| Item | Status |
|------|--------|
| Web Stripe Lite / Pro / gift | Live (`cs_live_…` sessions) |
| Native pricing UI Free / Lite / Pro | In app |
| RevenueCat iOS public key in `.env` | Set |
| ASC IAP Lite `com.playin432.app.truehz_lite` | READY_TO_SUBMIT |
| ASC IAP Pro `com.playin432.app.truehz_pro` | READY_TO_SUBMIT |
| Build **8** uploaded | VALID |
| Build **8** attached to iOS **1.0** | Yes |
| Review notes (no login / free path) | Updated via API |
| `demoAccountRequired` | **false** |
| Privacy URL | https://playin432.com/privacy.html |

## You must confirm in App Store Connect (manual)

Open: https://appstoreconnect.apple.com/apps/6792840657

### 1. Version 1.0 content
- [ ] Screenshots present (6.7" / 6.1" / iPad if needed)
- [ ] Description, keywords, support URL, marketing URL
- [ ] Age rating complete
- [ ] App Privacy questionnaire complete
- [ ] Export compliance (encryption) answered

### 2. In-App Purchases
- [ ] Lite + Pro appear under version 1.0 **In-App Purchases and Subscriptions** (or are submitted with the app)
- [ ] Each IAP has localization + review screenshot if Apple requires it for first IAP

### 3. Agreements
- [ ] **Paid Apps Agreement** Active  
- [ ] Banking + tax complete  

### 4. Sandbox test (recommended before submit)
- [ ] Sandbox Apple ID on device  
- [ ] Unlock Lite (StoreKit sheet)  
- [ ] Unlock Pro  
- [ ] Restore purchases  

### 5. Submit
- [ ] Version 1.0 uses **build 8**  
- [ ] **Add for Review** / **Submit to App Review**  
- [ ] If a Review Submission was started via API, finish any missing items in the UI and submit  

## Product notes for reviewers (already in ASC notes)

- No account / no demo login  
- Free: import file → A=440→432  
- Spotify optional, metadata only  
- IAP: Lite + Pro non-consumables via StoreKit  

## Local native version after this pass

- iOS `CURRENT_PROJECT_VERSION` = **8**  
- Android `versionCode` = **8**  
