# App Store Offer Codes — Play In 432

Configured on **TrueHz Pro** (`com.playin432.app.truehz_pro`).

| Reference name | Offer type | Product unlocked | Eligibility | Status |
|----------------|------------|------------------|-------------|--------|
| **Free** | Free ($0) | TrueHz Pro (lifetime non-consumable) | Everyone | **Active** |
| **30-Day** | Free ($0) | TrueHz Pro (lifetime non-consumable) | Everyone | **Active** |

Offer IDs (App Store Connect):
- Free: `312fc229-de27-4baf-bef1-21a17d92940a`
- 30-Day: `016cbd0c-a9d9-4895-9b02-94ff21269c6e`

## Important: non-consumable = permanent unlock

These offers discount the **existing one-time Pro product**. When someone redeems a free offer code, they receive **lifetime TrueHz Pro**, not a timed trial.

A true **30-day temporary** account would need a separate **non-renewing subscription** or **auto-renewable subscription** product. That is not what these codes do.

Use **Free** / **30-Day** as marketing campaign names (e.g. press, beta partners). Both grant the same free Pro unlock.

## Generating redeemable codes (blocked until live)

Apple only allows **custom** and **one-time-use** production codes when:

1. The **app** is Ready for Distribution (live / approved), and  
2. The **IAP** is **Approved**.

Until 1.1.0 ships and TrueHz Pro is approved, you cannot mint `FREE` / `30DAY` production codes. After approval:

**App Store Connect → Play In 432 → Monetization → In-App Purchases → TrueHz Pro → Offer Codes**

| Offer | Suggested custom code | Redemption limit | Notes |
|-------|----------------------|------------------|-------|
| Free | `FREE` | e.g. 1000 | Campaign / partners |
| 30-Day | `30DAY` | e.g. 1000 | Time-limited promo name only |

Or create batches of one-time-use codes (min 500 per batch).

### Sandbox testing

After the IAP is approved, create **Sandbox codes** on each offer and redeem with a Sandbox Apple ID (Settings → App Store → Sandbox Account).

In-app redemption needs StoreKit offer-code UI (iOS 16.3+). RevenueCat/StoreKit may expose this; customers can also redeem via App Store redemption URL.

## Where to manage

App Store Connect → **Apps → Play In 432 → In-App Purchases → TrueHz Pro → Offer Codes**
