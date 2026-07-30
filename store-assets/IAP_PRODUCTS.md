# In-App Purchases — Play In 432

## Products (create in App Store Connect if missing)

| Type | Product ID | Price (USA) | Tier |
|------|------------|-------------|------|
| **Non-Consumable** Lite | `com.playin432.app.truehz_lite` | **$9.99** | Lite |
| **Non-Consumable** Pro lifetime | `com.playin432.app.truehz_pro` | **$19.99** | Pro |
| Auto-renewable monthly | `com.playin432.app.truehz_pro.monthly` | **$4.99**/mo | Pro |
| Auto-renewable yearly | `com.playin432.app.truehz_pro.yearly` | **$29.99**/yr | Pro |

## Create Lite in App Store Connect

1. App → **Monetization → In-App Purchases** → **+**  
2. Type: **Non-Consumable**  
3. Reference name: `TrueHz Lite`  
4. Product ID: `com.playin432.app.truehz_lite` (exact)  
5. Price: **$9.99** (USA)  
6. Localization: display name **TrueHz Lite**, description matching web  
7. Submit with next app version (or after 1.0 is live as an IAP update)

## RevenueCat

Automated (preferred):

```bash
export REVENUECAT_SECRET_API_KEY='sk_…'   # V2 secret
node scripts/setup-revenuecat.mjs
```

Manual checklist:

1. **Products** → import / add `com.playin432.app.truehz_lite` + `…truehz_pro`  
2. **Entitlements**:
   - `truehz_lite` → attach Lite product  
   - `truehz_pro` → attach all Pro products  
3. **Offering** `default` (Current): packages `lite` + `lifetime` (+ monthly/yearly if kept)  
4. Wire **In-App Purchase .p8** on the iOS app (bundle `com.playin432.app`)  
5. Copy public `appl_…` key → `.env` `VITE_REVENUECAT_IOS_API_KEY` → `npm run mobile:sync`

Full guide: `store-assets/REVENUECAT.md`

## Web (Stripe)

| Tier | Env (optional fixed Price) | Fallback |
|------|----------------------------|----------|
| Pro | `STRIPE_PRICE_ID` | $19.00 `price_data` |
| Lite | `STRIPE_LITE_PRICE_ID` | $9.99 `price_data` |

## Gift email (optional)

| Env | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Send gift redeem emails |
| `GIFT_FROM_EMAIL` | e.g. `Play In 432 <gifts@yourdomain.com>` |

Gifter can also copy the `cs_…` code from the success toast without email.
