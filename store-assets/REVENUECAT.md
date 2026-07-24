# RevenueCat setup — Play In 432

Native IAP goes through **RevenueCat**. Web still uses **Stripe**.

## 1. Create project

1. [app.revenuecat.com](https://app.revenuecat.com) → New project **Play In 432**
2. Add apps:
   - **iOS** — bundle `com.playin432.app`
   - **Android** — package `com.playin432.app` (when ready)

## 2. Connect App Store

1. RevenueCat → Project → **Apps** → iOS app  
2. Upload **In-App Purchase Key** (.p8) from App Store Connect  
   **OR** use Shared Secret / App Store Connect API as RevenueCat documents  
3. Recommended: App Store Connect → Users → **In-App Purchase Key** for RevenueCat

### App Store Connect products (already created)

| Product ID | Type |
|------------|------|
| `com.playin432.app.truehz_pro` | Non-consumable $19.99 |
| `com.playin432.app.truehz_pro.monthly` | Subscription $4.99/mo |
| `com.playin432.app.truehz_pro.yearly` | Subscription $29.99/yr |

Import / attach these product IDs in RevenueCat → **Products**.

## 3. Entitlement

Create entitlement:

```
truehz_pro
```

Attach **all three** products to this entitlement.

## 4. Offering

1. Create offering identifier: **`default`** (or mark as Current)  
2. Add packages:
   - Lifetime → `com.playin432.app.truehz_pro` (package id e.g. `$rc_lifetime` or custom)
   - Annual → yearly product
   - Monthly → monthly product  
3. Make this offering **Current**

The app prefers packages in order: **lifetime → yearly → monthly**.

## 5. API keys → app env

RevenueCat → Project settings → **API keys**:

| Key | Env var |
|-----|---------|
| Apple app public key (`appl_…`) | `VITE_REVENUECAT_IOS_API_KEY` |
| Google app public key (`goog_…`) | `VITE_REVENUECAT_ANDROID_API_KEY` |

### Local `.env`

```bash
VITE_REVENUECAT_IOS_API_KEY=appl_xxxxxxxx
VITE_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxx
```

### Vercel (for web builds that embed keys — optional)

Only needed if you ship a Capacitor web build via CI with keys baked in:

```bash
vercel env add VITE_REVENUECAT_IOS_API_KEY production
vercel env add VITE_REVENUECAT_ANDROID_API_KEY production
```

Then rebuild / `npm run mobile:sync`.

## 6. Code map

| File | Role |
|------|------|
| `src/lib/revenueCat.ts` | configure, purchase, restore, sync |
| `src/lib/products.ts` | product IDs |
| `src/lib/pro.ts` | `startCheckout()` → RC native / Stripe web |
| `src/hooks/usePro.ts` | upgrade + restore UI |

Entitlement checked: **`truehz_pro`**

## 7. Test

1. App Store Connect → Sandbox Tester account  
2. Device/simulator signed out of real Apple ID for IAP, use Sandbox  
3. `npm run mobile:ios` → Unlock Pro → Sandbox purchase sheet  
4. Kill app → Restore purchases  

## 8. Submit

When submitting app version 1.0, include IAP **TrueHz Pro** for review (first non-consumable with version).
