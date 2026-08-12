# Google Play Console — Fill sheet (copy/paste)

**You:** open [play.google.com/console](https://play.google.com/console), create the app, paste these answers, upload assets, submit.  
**Already prepared:** signed AAB + icons + screenshots in this folder.

| Prepared file | Use for |
|---------------|---------|
| `play-in-432-1.1.0-vc11.aab` | Release → upload |
| `icons/icon-512.png` | Store listing high-res icon |
| `feature-graphic-1024x500.png` | Feature graphic |
| `screenshots-phone/` (5 PNGs) | Phone screenshots (order 01→05) |
| `screenshots-tablet/` (5 PNGs) | 7" tablet (optional) |

**Package (from AAB):** `com.playin432.app`  
**Version name / code:** `1.1.0` / `11`  
**Support email (from iOS docs):** `brad@geisen.cc` ← change if you prefer  
**Contact name:** Bradford Geisen  
**Website / support:** https://playin432.com  
**Privacy:** https://playin432.com/privacy.html  

---

# A. Create app

| Field | Value |
|-------|--------|
| App name | Play In 432 |
| Default language | English (United States) – **en-US** |
| App or game | **App** |
| Free or paid | **Free** |
| Declarations | Accept Developer Program Policies, US export laws, etc. |

---

# B. Main store listing  
**Grow → Store presence → Main store listing** (or **Store settings** path in newer UI)

## Text

**App name** (30 chars max)

```
Play In 432
```

**Short description** (80 chars max) — *exact, 73 chars*

```
Retune your music to 432 Hz with TrueHz — private, on-device, no account.
```

**Full description**

```
Play In 432 is a private music player that retunes files you already own for 432 Hz listening - powered by TrueHz technology.

YOUR MUSIC, ON YOUR DEVICE
- Import MP3, WAV, FLAC, M4A, OGG and more
- Library and playlists stay on your device
- No account required to listen
- Your audio is never uploaded for playback

TRUEHZ RETUNE
- Live retune A=440 to A=432 (and more with Pro)
- Optional TrueHz pure-tone bed at the target frequency
- Frequency strip with Re-anchor or Concert A modes
- Learn tab with honest science - no fake healing claims

HQ EXPORT (TrueHz Convert)
- High-quality offline WAV export
- Free tier includes limited HQ exports
- Pro unlocks unlimited TrueHz Convert downloads

TRUEHZ PRO
- All Solfeggio and custom frequency targets
- Unlimited HQ exports
- One-time in-app unlocks - no subscription required for core 432 listening

Play In 432 is part of the Rise In Harmony family.
https://playin432.com
https://playin432.com/privacy.html
```

## Graphics (upload from this folder)

| Slot | File | Order |
|------|------|-------|
| App icon | `icons/icon-512.png` | — |
| Feature graphic | `feature-graphic-1024x500.png` | — |
| Phone screenshots | `screenshots-phone/01-hero.png` … `05-learn.png` | 01 first |
| 7" tablet (optional) | `screenshots-tablet/01-hero.png` … | same order |

**Suggested caption order (not a field, just mental model):**  
1 Hero · 2 Frequencies · 3 Pricing · 4 Player · 5 Learn  

## Contact & policy (often under Store settings)

| Field | Value |
|-------|--------|
| Email | brad@geisen.cc |
| Phone | *(your phone — optional but recommended)* |
| Website | https://playin432.com |
| Privacy policy | https://playin432.com/privacy.html |

---

# C. Store settings / categorization

| Field | Value |
|-------|--------|
| App category | **Music & Audio** |
| Tags (optional) | music player, audio tools, equalizer *(or leave blank)* |
| External marketing | Yes you may promote outside Play (or per your preference) |

---

# D. App content questionnaires

Complete every item under **Policy → App content** (names vary slightly).

## 1. Privacy policy

```
https://playin432.com/privacy.html
```

## 2. App access

| Question | Answer |
|----------|--------|
| All functionality available without restrictions? | **Yes** — no login required for free 432 listening |
| Special access instructions? | **No** (or paste notes below if they ask for tester notes) |

**If they ask how to access features:**

```
No account needed. Launch app → import any short MP3/WAV → play and toggle Original vs Retune (A=440→A=432). Free tier includes core 432 listening. Lite/Pro are optional one-time unlocks via Google Play Billing.
```

## 3. Ads

| Question | Answer |
|----------|--------|
| Does your app contain ads? | **No** |

## 4. Content ratings (IARC questionnaire)

Start questionnaire → answer for **Music & Audio** / Utility app.

| Topic | Answer |
|-------|--------|
| Violence | No |
| Sexual content | No |
| Language | No (or mild if any song titles — app itself has none) |
| Controlled substances | No |
| User interaction / UGC chat | **No** shared social features / no public UGC feed |
| Share location | No |
| Users can interact online | No (local player only) |
| Personal info sharing | No |
| Age-restricted purchases | Digital goods yes → in-app purchases exist (Lite/Pro one-time) |
| Medical/treatment claims | **No** |

Expected outcome: **Everyone** / **PEGI 3** / similar (exact labels depend on questionnaire).

## 5. Target audience and content

| Field | Value |
|-------|--------|
| Target age groups | **18 and over** (or 13+ if you prefer; app is not for kids) |
| Appeal to children | **No** |
| Store presence designed for children | **No** |

## 6. News apps

| Question | Answer |
|----------|--------|
| Is this a news app? | **No** |

## 7. COVID-19 contact tracing / status apps

| Question | Answer |
|----------|--------|
| | **No** |

## 8. Data safety  ← fill carefully

**Does your app collect or share any of the required user data types?**  
→ **Yes** (Play Billing / purchase-related; optional email if user provides for unlock restore)

### Data types to declare

| Data type | Collect? | Shared? | Purpose | Ephemeral? | Required or optional | Linked to identity? |
|-----------|----------|---------|---------|------------|----------------------|---------------------|
| **Audio files** | Yes (on device) | **No** | App functionality (play / retune / export) | No (stored in app until user deletes) | Optional (user chooses to import) | No |
| **Purchase history** | Yes (via Google Play) | Shared with Google Play / RevenueCat as processors | App functionality, account management | No | Optional (only if they buy) | Yes (linked to Google account by Play) |
| **User IDs** (if RevenueCat/Play assigns) | Yes | With RevenueCat / Play | App functionality, fraud prevention | No | Optional / automatic with Play | Yes (Play account) |
| **Device or other IDs** | Yes (Play/RevenueCat may) | With Play / RevenueCat | App functionality, fraud prevention | No | Automatic with billing | Prefer **Yes** linked via Play |
| **Email address** | Only if user enters for gift/unlock code restore | May go to your email/ESP if configured | Account management / customer support | No | Optional | Yes if provided |
| Name, phone, address, photos, location, contacts, SMS, health, etc. | **No** | — | — | — | — | — |

**Important UX answers:**

| Question | Answer |
|----------|--------|
| Data encrypted in transit? | **Yes** |
| Users can request data deletion? | **Yes** |
| Deletion instructions | Uninstall app / clear app storage removes on-device library. For purchase records contact support at brad@geisen.cc. Play purchase history managed via Google account. |
| Independent security review? | **No** (unless you have one) |

**Do not claim** you collect audio *on your servers* — you do not. In the form, if Google only offers “collected,” declare collection **for app functionality**, **not shared**, **not processed off-device** where that option exists. Mirror privacy policy: files stay on device.

## 9. Government apps

| Question | Answer |
|----------|--------|
| | **No** |

## 10. Financial features

| Question | Answer |
|----------|--------|
| Banking, lending, wallets, crypto trading, etc. | **No** |
| (IAP digital unlocks are normal Play Billing, not “financial features” in the banking sense) | |

## 11. Health

| Question | Answer |
|----------|--------|
| Health / medical features | **No** |
| Notes | Retune is pitch shift only; no medical/healing claims |

## 12. Permissions declaration (if prompted)

| Permission | Why |
|------------|-----|
| INTERNET | Checkout APIs, Play Billing, optional restore |
| READ_MEDIA_AUDIO / storage (legacy) | User imports their music files |
| BILLING | Lite / Pro one-time products |
| VIBRATE | Haptics (Capacitor) |
| MODIFY_AUDIO_SETTINGS | Audio playback |

## 13. Advertising ID (if asked)

| Question | Answer |
|----------|--------|
| Uses advertising ID? | **No** (no ads SDK). If RevenueCat/Play uses an ID only for purchases, declare per their latest guidance — do **not** enable advertising use cases. |

---

# E. Countries / pricing

| Field | Value |
|-------|--------|
| Countries | **All countries** (or your choice) |
| Free app | Yes |
| Tax / payments profile | Complete if not already (required to sell IAP) |

---

# F. In-app products  
**Monetize with Play → Products → In-app products**

Create **two one-time products** (not subscriptions).

### Product 1 — Lite

| Field | Value |
|-------|--------|
| Product ID | `com.playin432.app.truehz_lite` |
| Name | TrueHz Lite |
| Description | All Solfeggio & custom frequency targets + 10 HQ exports per month. One-time unlock. |
| Default price | **USD 9.99** (auto-convert other countries) |
| Status | **Active** |

### Product 2 — Pro

| Field | Value |
|-------|--------|
| Product ID | `com.playin432.app.truehz_pro` |
| Name | TrueHz Pro |
| Description | All frequencies + unlimited TrueHz Convert HQ exports + batch export. One-time unlock. |
| Default price | **USD 19.99** |
| Status | **Active** |

> IAP can be submitted with the first app release. Wire RevenueCat Android + `VITE_REVENUECAT_ANDROID_API_KEY` for purchases to work on device (free retune works without this).

---

# G. Release — upload AAB

**Recommended first:** Testing → **Internal testing** → Create new release  

Then later: **Production**

| Field | Value |
|-------|--------|
| App bundles | Upload **`play-in-432-1.1.0-vc11.aab`** (this folder) |
| Play App Signing | **Enroll / Accept** (first upload) — keep your local upload keystore backed up |
| Release name | `1.1.0 (11)` |
| Release notes (en-US) | *paste below* |

### Release notes

```
First Android release of Play In 432.

• Import your music and retune A=440 → A=432 with TrueHz
• Optional pure-tone bed and frequency targets
• HQ WAV export (TrueHz Convert)
• Private on-device library — no account required to listen
• Optional one-time Lite / Pro unlocks
```

### Notes for Google (review / “notes for reviewers” if present)

```
Play In 432 retunes audio files the user imports (pitch shift, e.g. A=440→A=432).

No account or login is required for free 432 listening.
HOW TO TEST:
1. Launch the app.
2. Import any short MP3 or WAV from device storage/Files.
3. Playback; toggle Original vs Retune to hear A=440 → A=432.
4. Free tier includes core 432. Other targets may show Lite/Pro upgrade.
5. HQ export produces a retuned WAV (limited on free tier).

Music is processed and stored on-device. We do not upload the user’s library for playback.

Purchases: TrueHz Lite and TrueHz Pro are one-time Google Play Billing products (not subscriptions). Product IDs:
com.playin432.app.truehz_lite
com.playin432.app.truehz_pro

No medical or healing claims. Learn tab explains the math honestly.
Privacy: https://playin432.com/privacy.html
Support: https://playin432.com · brad@geisen.cc
```

---

# H. Click order (fast path)

Do this in order so the dashboard goes green:

1. **Create app** (section A)  
2. **Main store listing** — text + icon + feature graphic + ≥2 phone screenshots (B)  
3. **Store settings** — category Music & Audio, contact, privacy URL (C)  
4. **App content** — privacy, access, ads, ratings, audience, data safety, etc. (D)  
5. **In-app products** — create + activate Lite + Pro (F)  
6. **Internal testing** — upload AAB, add your Gmail as tester, install & smoke-test (G)  
7. **Production** — create release from same AAB (or promote), **Send for review / Start rollout**  

Only step 7 is “submit.” Everything above is fill-out.

---

# I. Smoke-test checklist (internal track)

- [ ] App installs from internal testing link  
- [ ] Launch → dark splash → UI loads  
- [ ] Import short audio file  
- [ ] Original / Retune 432 audible difference  
- [ ] HQ export works or shows free-tier limit cleanly  
- [ ] Lite/Pro purchase with **license test account** (Play Console → Settings → License testing)  
- [ ] No crash on cold start  

---

# J. What you still must do in the browser (cannot be pre-filled offline)

| Task | Why |
|------|-----|
| Sign in to Play Console | Your Google account only |
| Create app + accept legal | Account-bound |
| Upload files | Drag/drop in Console |
| Complete identity / payments / tax if unfinished | Account-bound |
| Click **Send for review** | Account-bound |
| RevenueCat Google service account JSON | Your Google Cloud + RC dashboards |

---

# K. Paths on disk

```
/Users/bradgeisen/Grok/play-in-432/store-assets/google-play/
  play-in-432-1.1.0-vc11.aab
  feature-graphic-1024x500.png
  icons/icon-512.png
  screenshots-phone/01-hero.png … 05-learn.png
  screenshots-tablet/01-hero.png … 05-learn.png
  PLAY_CONSOLE_FILL_SHEET.md   ← this file

Upload keystore (backup!):
  /Users/bradgeisen/Grok/play-in-432/.secrets/
```

Finder:

```bash
open /Users/bradgeisen/Grok/play-in-432/store-assets/google-play
open https://play.google.com/console
```
