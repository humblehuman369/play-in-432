# In-App Purchases & Subscriptions — Play In 432

Configured in App Store Connect via API (2026-07-20).

## Products

| Type | Product ID | Price (USA) | ASC State |
|------|------------|-------------|-----------|
| **Non-Consumable** (lifetime) | `com.playin432.app.truehz_pro` | **$19.99** | READY_TO_SUBMIT |
| **Auto-renewable** monthly | `com.playin432.app.truehz_pro.monthly` | **$4.99**/mo | MISSING_METADATA* |
| **Auto-renewable** yearly | `com.playin432.app.truehz_pro.yearly` | **$29.99**/yr | MISSING_METADATA* |

\*Subscriptions may still show MISSING_METADATA until all territories/pricing fully process; localizations + USA prices + availability were set.

**Subscription group:** TrueHz Membership  

## What unlocks (same Pro entitlements)

- All Solfeggio / custom frequency targets  
- Unlimited TrueHz Convert HQ WAV exports  

## Important Apple rules

1. **First non-consumable** must be submitted **with an app version** (not alone).  
   When you submit version 1.0 for review, **include** “TrueHz Pro” lifetime IAP.
2. **Paid Apps Agreement** + banking/tax must be Active in  
   App Store Connect → **Business** / **Agreements, Tax, and Banking**.
3. Sandbox testing: create a Sandbox Apple ID under Users and Access → Sandbox.
4. Web (playin432.com) still uses **Stripe** for non-iOS purchases.  
   On iOS, use **StoreKit / IAP** (required for digital unlocks in-app).

## App code

Product IDs live in `src/lib/products.ts`.

## Submit with app version

App Store Connect → Play In 432 → version 1.0 →  
**In-App Purchases and Subscriptions** → add:

- TrueHz Pro (`com.playin432.app.truehz_pro`)

Then Submit for Review.

## Optional cleanup

If you only want **lifetime** (recommended brand story), you can leave monthly/yearly in ASC as “ready later” or remove them in the console. Lifetime alone matches “$19 one-time.”
