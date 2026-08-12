# Sandbox IAP test — Play In 432

**Goal:** Unlock Lite or Pro once in sandbox so App Review’s purchase path is proven.

---

## What is already set up

| Item | Value |
|------|--------|
| Sandbox tester (ASC) | **humblehuman369@gmail.com** (USA) |
| Products | `com.playin432.app.truehz_lite` · `com.playin432.app.truehz_pro` |
| Build with RevenueCat key | **12** (VALID in App Store Connect) |
| Local StoreKit file | `ios/App/PlayIn432.storekit` (both non-consumables) |
| Xcode scheme | `App` → Launch uses `PlayIn432.storekit` |

You **cannot** complete a real Sandbox purchase from this machine without a physical device + the sandbox password. The steps below are what you (or a teammate) run on an iPhone/iPad.

---

## Path A — Physical device (what App Review uses)

### 1. Sandbox account on the device

1. Open **Settings → Developer** (or **Settings → App Store** on older iOS).
2. Under **Sandbox Account**, sign in as:

   **Email:** `humblehuman369@gmail.com`  
   **Password:** the password you set when you created this tester in App Store Connect  
   (Users and Access → Sandbox → Testers)

3. Do **not** use this Apple ID as the main App Store login on the device.

If you forgot the password: App Store Connect → **Users and Access → Sandbox → Testers** → edit tester / reset password (or create a new tester).

### 2. Install the build under test

Prefer the **same binary** reviewers get:

- **Option 1 (best):** TestFlight internal → build **12**, or  
- **Option 2:** Xcode → device → Run **Release/Debug** of `com.playin432.app` from this repo after `npm run mobile:sync`.

### 3. Buy once

1. Launch **Play In 432**.
2. Tap the **crown / Upgrade**.
3. Tap **Unlock Pro** (or **Unlock Lite**).
4. Confirm the **StoreKit / Apple pay sheet** appears.
5. Approve with the **sandbox** account (may ask for password; charges are fake).
6. Confirm Pro/Lite unlocks (frequencies / export limits change).
7. Optional: kill app → **Restore Purchases** → still unlocked.

### Pass criteria

- [ ] Sheet appears (not a red error toast only)
- [ ] Purchase completes without “products didn’t load” / “temporarily unavailable”
- [ ] Entitlement sticks after relaunch or Restore

If the sheet never appears and you see a product-load error, check:

1. Paid Apps Agreement **Active** (Business)  
2. RevenueCat → iOS app → App Store Connect **In-App Purchase key** uploaded  
3. Default offering has packages for Lite + Pro only (no missing subscription products)

---

## Path B — Simulator / Xcode StoreKit Testing (dev only)

Good for UI + product IDs; **not** a substitute for Path A before resubmit.

```bash
cd /Users/bradgeisen/Grok/play-in-432
npm run mobile:sync
npx cap open ios
```

1. Scheme **App** (shared) already references `PlayIn432.storekit`.
2. Run on an **iPhone simulator**.
3. Upgrade → Unlock Pro/Lite → local StoreKit sheet should complete.

To toggle: Xcode → Product → Scheme → Edit Scheme → Run → Options → **StoreKit Configuration** = `PlayIn432.storekit`.

---

## Soften review notes if you skip Path A

Only claim “Sandbox-tested” if Path A passed. Otherwise use:

> Purchase flow uses StoreKit via RevenueCat. Products:  
> com.playin432.app.truehz_lite · com.playin432.app.truehz_pro  
> Please test Unlock Lite/Pro with a sandbox account. Free path works without purchase.

---

## After a successful sandbox buy

You can submit. App Review uses the same IAP sandbox path; products do not need prior approval to work in review.
