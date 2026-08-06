# RevenueCat setup — Play In 432

Native IAP goes through **RevenueCat**. Web still uses **Stripe**.

**App code is ready.** You need dashboard wiring (one-time) + the public SDK key in `.env`.

## Quick path (script)

1. [app.revenuecat.com](https://app.revenuecat.com) → your project (or create **Play In 432**)
2. **Project settings → API keys → + New**
   - Version: **V2**
   - Permissions: `project_configuration` **read_write** for apps, products, entitlements, offerings
3. Run:

```bash
cd truehz-player
export REVENUECAT_SECRET_API_KEY='sk_…'   # V2 secret — never commit
node scripts/setup-revenuecat.mjs   # creates Lite + Pro lifetime (no subscriptions)
```

The script creates products, entitlements, packages, writes `.secrets/revenuecat-setup.json`, and updates `.env` with `VITE_REVENUECAT_IOS_API_KEY` when the public key is available.

4. Still manual: **connect App Store credentials** (In-App Purchase Key) under RevenueCat → Apps → iOS.

---

## 1. Project & apps

| App | Bundle / package |
|-----|------------------|
| iOS | `com.playin432.app` |
| Android (later) | `com.playin432.app` |

Existing project id (if already created): see `.secrets/revenuecat-setup.json`.

## 2. Connect App Store (required for real purchases)

1. App Store Connect → **Users and Access → Integrations → In-App Purchase**  
2. Generate key → download `.p8` once  
3. RevenueCat → **Apps → Play In 432 iOS → App Store Connect API / IAP key**  
4. Upload key + enter Key ID + Issuer ID  

Without this, offerings may be empty on device and purchases fail.

## 3. App Store Connect products (already created)

| Product ID | Type | Price (USA) | ASC state |
|------------|------|-------------|-----------|
| `com.playin432.app.truehz_lite` | Non-consumable | $9.99 | READY_TO_SUBMIT |
| `com.playin432.app.truehz_pro` | Non-consumable | ~$19.99 | READY_TO_SUBMIT |

One-time only — **no subscriptions**. The auto-renewable monthly/yearly Pro
products were removed from the app (they contradicted the "one-time" promise
and blocked App Store review). Do not re-add them to the offering.

## 4. Entitlements (must match code)

| Lookup key | Products |
|------------|----------|
| `truehz_lite` | `…truehz_lite` |
| `truehz_pro` | `…truehz_pro` |

Code: `src/lib/revenueCat.ts` — Pro implies full access; Lite = frequencies + 10 HQ/month.

## 5. Offering

| Field | Value |
|-------|--------|
| Lookup key | `default` (Current) |
| Packages | `lite` → Lite product, `lifetime` → Pro lifetime (no subscriptions) |

App picks the `lifetime` package for Pro and `lite` for Lite.

## 6. API keys → app env

| Key | Env var |
|-----|---------|
| Apple public SDK key (`appl_…`) | `VITE_REVENUECAT_IOS_API_KEY` |
| Google public SDK key (`goog_…`) | `VITE_REVENUECAT_ANDROID_API_KEY` |

### Local `.env`

```bash
VITE_REVENUECAT_IOS_API_KEY=appl_xxxxxxxx
# VITE_REVENUECAT_ANDROID_API_KEY=goog_xxxxxxxx
```

Then rebuild the native shell so the key is baked into the web assets:

```bash
npm run mobile:sync
```

`.env` is local-only — do not commit secrets.

## 7. Code map

| File | Role |
|------|------|
| `src/lib/revenueCat.ts` | configure, packages, purchase Lite/Pro, restore, sync |
| `src/lib/products.ts` | product IDs |
| `src/lib/pro.ts` | `startCheckout()` → RC native / Stripe web; gifts always Stripe |
| `src/hooks/usePro.ts` | upgrade + restore UI |
| `src/components/PricingSection.tsx` | Free / Lite / Pro + gift + restore |
| `scripts/setup-revenuecat.mjs` | dashboard bootstrap via API v2 |

## 8. Test (Sandbox)

1. App Store Connect → **Users and Access → Sandbox → Testers** → create tester  
2. On device: Settings → App Store → Sandbox Account  
3. `npm run mobile:ios` (or Xcode) → **Unlock Lite** / **Unlock Pro**  
4. Confirm entitlement unlocks frequencies / batch  
5. Kill app → **Restore purchases**  

## 9. App Review

When submitting iOS **1.0** (build 5):

- Include **TrueHz Lite** and **TrueHz Pro** IAPs with the version  
- Review notes: no login required; Free path is full 432 listening without purchase  
- Paid Apps agreement + banking/tax must be active for IAP to work in production  

## 10. Web (Stripe) — separate from RevenueCat

| Tier | Price | Env |
|------|-------|-----|
| Lite | $9.99 | `STRIPE_LITE_PRICE_ID` optional |
| Pro | $19 | `STRIPE_PRICE_ID` optional |
| Gifts | same | always Stripe + optional `RESEND_API_KEY` |

Cross-restore: Stripe email / `cs_…` session on any platform; App Store via RevenueCat restore on native.
