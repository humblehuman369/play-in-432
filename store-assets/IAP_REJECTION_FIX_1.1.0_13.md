# IAP rejection fix — 1.1.0 build **13**

**Rejected:** Aug 14, 2026 · Guideline 2.1(b) · Build **12**  
**Symptom:** Error when tapping Unlock Pro / Unlock Lite (iPad Air, iPadOS 26.6)

---

## Root cause (most likely)

Reviewer hit a **purchase path that failed before StoreKit sheet**:

1. **RevenueCat offerings empty / misconfigured** → previous code only bought via `purchasePackage` and threw a red error when packages were empty.  
2. **App Store Connect ↔ RevenueCat credentials** may still be missing (IAP `.p8` key not uploaded in RC dashboard). Without that, product metadata often fails to resolve.  
3. **Paid Apps Agreement** must be **Active** (Business) or sandbox purchases fail for everyone including App Review.

ASC product IDs are correct and were **IN_REVIEW** at time of rejection:
- `com.playin432.app.truehz_lite`
- `com.playin432.app.truehz_pro`

---

## Code fix (build 13)

`src/lib/revenueCat.ts` now:

1. **Primary path:** `getProducts([productId])` + `purchaseStoreProduct` (direct StoreKit product IDs).  
2. **Fallback:** offering packages if direct path fails.  
3. **Unlock grant** by product ID even if entitlement map lags.  
4. Clearer errors for missing products / billing unavailable.

Rebuild with `VITE_REVENUECAT_IOS_API_KEY` baked in (verified `appl_` in ios public assets).

---

## You must verify in dashboards (before resubmit)

### 1. Paid Apps Agreement
App Store Connect → **Business** → Paid Apps = **Active** (banking + tax complete).

### 2. RevenueCat App Store credentials
[app.revenuecat.com](https://app.revenuecat.com) → Project → Apps → **Play In 432 iOS**  
→ App Store Connect API / **In-App Purchase key**  
Upload `.p8` + Key ID + Issuer ID.

Local key material (do not commit):
- Key ID: `3R9NHPS286`  
- File: `play-in-432/.secrets/SubscriptionKey_3R9NHPS286.p8`  
- Issuer: same as ASC (`80f1a1d2-…`)

### 3. RevenueCat offering
Default **current** offering packages should be **only**:
- `lite` → `com.playin432.app.truehz_lite`  
- `lifetime` → `com.playin432.app.truehz_pro`  

Remove monthly/yearly from the **current** offering if still present (products may 404 and confuse offerings).

### 4. Sandbox test on a real device
Settings → App Store → Sandbox Account → `humblehuman369@gmail.com`  
Install build **13** (TestFlight or Xcode) → Unlock Pro → sheet must appear.

---

## Resubmit steps

1. Wait until build **13** is **VALID** in ASC.  
2. Attach build **13** to iOS **1.1.0**.  
3. Confirm IAPs still attached.  
4. Review notes: mention direct StoreKit purchase path + product IDs.  
5. Submit for Review **only after sandbox purchase succeeds**.

---

## App Review notes (paste)

```
Thanks for re-reviewing 1.1.0 (build 13).

IAP FIX
• Unlock Lite/Pro now purchases StoreKit products by product ID
  (getProducts + purchaseStoreProduct), not only RevenueCat packages.
• Product IDs:
    com.playin432.app.truehz_lite  ($9.99, non-consumable)
    com.playin432.app.truehz_pro   ($19.99, non-consumable)
• Paid Apps Agreement is Active.
• No login required. Free path: import audio → play at A=432.
• Restore Purchases is on the upgrade sheet.

HOW TO TEST IAP
1. Tap crown / Upgrade → Unlock Pro or Unlock Lite.
2. Complete with sandbox account. StoreKit sheet should appear.
```
