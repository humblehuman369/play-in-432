# iOS submit — Play In 432 (your Mac)

**Team:** A2Y6C3NNSY (Bradford Ronald Geisen)  
**Bundle ID:** `com.playin432.app`  
**Version:** 0.1.0 (Build 1)

Signing is set to **Automatic** with your Development team in the Xcode project.

---

## A. Run on Simulator / iPhone (test first)

1. Xcode should be open on **App.xcodeproj**
2. Top bar: select target **App**
3. Device menu: pick an **iPhone simulator** (e.g. iPhone 16) **or** your physical iPhone
4. If device is grayed out: **Window → Devices and Simulators** → trust the phone
5. Press **▶ Run** (⌘R)
6. Test: drop a track → retune → play → try **Upgrade Pro**

### Physical iPhone first time
- Unlock phone → Trust This Computer  
- On phone: **Settings → General → VPN & Device Management** → trust your developer cert  

---

## B. Create App in App Store Connect

1. Open [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**
2. Platforms: **iOS**
3. Name: **Play In 432**
4. Primary language: English (U.S.)
5. Bundle ID: register `com.playin432.app` if missing under
   [Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
6. SKU: `playin432-ios-001` (any unique string)
7. User Access: Full Access

---

## C. Archive & Upload

1. In Xcode device menu: choose **Any iOS Device (arm64)**  
   (not a simulator — Archive is disabled on simulators)
2. Menu: **Product → Archive**
3. Wait for Organizer window
4. Select the archive → **Distribute App**
5. **App Store Connect** → **Upload** → Next
6. Leave defaults (bitcode off modern Xcode; strip symbols optional)
7. **Automatically manage signing** → your team
8. Upload → wait for processing email

---

## D. Store listing (paste)

| Field | Value |
|--------|--------|
| Name | Play In 432 |
| Subtitle | Your music, retuned to 432 |
| Privacy Policy | https://playin432.com/privacy.html |
| Support URL | https://playin432.com |
| Category | Music |
| Icon | `store-assets/app-icon-1024.png` |
| Description | See `STORE_LISTING.md` |

Screenshots: run Simulator → **File → New Screen Recording** or ⌘S on simulator for stills  
Need 6.7" and 6.1" iPhone sizes minimum.

### App Privacy questionnaire (honest answers)

- **Music / Audio files:** Yes — on device only, for playback  
- **Purchases:** Yes — Stripe via website/checkout (not IAP unless you add StoreKit later)  
- **Tracking:** No  
- **Linked to user:** Prefer “not linked” for local library  

**Note:** If Pro is sold **only** via Stripe web checkout (not Apple IAP), Apple may still ask about external purchase links under current rules — for v1 you can offer Pro **on the website** and keep the app free, or implement StoreKit later. Safest App Review path for music tools: **free app**, “manage subscription/purchase on website” if needed, or use **StoreKit** for $19 Pro.

---

## E. Submit for Review

1. App Store Connect → your app → version 0.1.0  
2. Select the build after processing finishes  
3. Fill screenshots, description, age rating  
4. **Add for Review** → **Submit**

---

## If Archive is grayed out

- Device = **Any iOS Device**, not Simulator  
- **Product → Clean Build Folder** (⇧⌘K) then Archive again  
- Signing: Target **App** → **Signing & Capabilities** → Team = **Bradford Ronald Geisen**

## If Bundle ID error

Register at developer.apple.com → Identifiers → **+** → App IDs → `com.playin432.app`
