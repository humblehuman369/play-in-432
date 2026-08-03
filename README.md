# Play In 432

![CI](https://github.com/humblehuman369/play-in-432/actions/workflows/ci.yml/badge.svg)

**Play In 432** — your music, retuned for 432 listening.  
**Powered by TrueHz™ technology.**

Domain: [playin432.com](https://playin432.com)

## Brand

| Layer | Name | Role |
|-------|------|------|
| **Product** | Play In 432 | Mass consumer player (upload, play, library, download) |
| **Technology** | TrueHz™ | Precision retune + pure-tone bed integrity |
| **HQ export** | TrueHz Convert | Rubber Band offline engine inside Play In 432 (Download HQ) |
| **Parent** | Rise In Harmony | Brand family |

Tagline: *Your music, retuned to 432 — powered by TrueHz technology.*

## Tabs

| Tab | What it is |
|-----|------------|
| **Player** | Drop music, transport, source→target retune, queue |
| **Frequency strip** | One-tap anchors · **Re-anchor** (note map) or **Concert A** (full ratio) |
| **Hear the difference** | Pure A4 sine A/B (source vs target) |
| **Mood guide** | Preference → target Hz (non-medical) |
| **Sleep timer** | 5–90 min with fade-out |
| **Library** | Full library (search, favorites, rename, delete) |
| **Playlists** | Create / edit; **import M3U**; **Spotify playlist → match library** |
| **Learn** | Honest science: ratio math, how far to retune, claims we reject, TrueHz tones, verify |

## Features

| Area | What you get |
|------|----------------|
| **Player (home)** | Dropzone, now playing, Original / Retune, seek, transport, bed |
| **Source → target A** | Presets (440→432, 444, 528*, reverse) + custom Hz; live ratio & cents |
| **Download HQ WAV** | TrueHz Convert engine: Rubber Band offline → 16-bit PCM WAV (local); SoundTouch fallback |
| **Pitch estimate** | Best-effort concert A detection; accept as Source A or dismiss |
| **Media keys** | Browser Media Session (play/pause/next/prev/seek) |
| **ID3 tags** | Title, artist, album, cover art on import |
| **Library** | Import MP3 / WAV / M4A / FLAC / OGG — IndexedDB |
| **Playlists** | Create, rename, delete, add/remove, drag reorder |
| **TrueHz bed** | Optional pure sine at target Hz under the track |
| **Persistence** | Library, playlists, settings survive refresh |
| **Learn** | 6 articles: retune math, non-claims, pure tones, quality, verify, research limits |

Files never leave your device.

## Run

```bash
cd play-in-432   # local folder name
npm install
npm run dev
```

Open the URL Vite prints (usually `http://127.0.0.1:5173/` for Spotify).

### Deploy on Vercel

This is a static Vite app (`dist/`). Config is in `vercel.json`.

```bash
cd play-in-432
npm i -g vercel   # if needed
vercel login
vercel            # first deploy (preview)
vercel --prod     # production
```

Or: push this repo to GitHub → [vercel.com/new](https://vercel.com/new) → import project  
(Framework: Vite · Build: `npm run build` · Output: `dist`).

**Domain playin432.com**

1. Vercel project → **Settings → Domains** → add `playin432.com` (and optional `www`).
2. In GoDaddy DNS, **replace** the parking A records with the values Vercel shows (often `A @ → 76.76.21.21` and/or a CNAME for `www`).
3. Wait for HTTPS (automatic). Confirm `https://playin432.com`.
4. Spotify redirect URIs: `https://playin432.com/` and `http://127.0.0.1:5173/`.
5. Optional env in Vercel: `VITE_SPOTIFY_CLIENT_ID` (rebuild after set).
6. Stripe TrueHz Pro — see below.

Music stays in the **user’s browser IndexedDB** — Vercel only hosts the app files (+ Stripe API routes).

### Tiers · Stripe (one-time)

| Free forever | TrueHz Lite ($9.99) | TrueHz Pro ($19) |
|--------------|---------------------|------------------|
| Live A=440 → A=432 | All Solfeggio / custom targets | Everything in Lite |
| Library, playlists, Learn | 10 HQ exports / month (TrueHz Convert) | Unlimited HQ WAV + batch export |
| 3 HQ exports (lifetime) | One-time payment, no subscription | One-time payment, no subscription |

**Vercel env (Production + Preview):**

```bash
vercel env add STRIPE_SECRET_KEY production
# paste sk_test_… or sk_live_…

# optional fixed Stripe Price id
# vercel env add STRIPE_PRICE_ID production

# optional APP_URL=https://playin432.com
```

**Stripe Dashboard**

1. [API keys](https://dashboard.stripe.com/apikeys) → Secret key  
2. Optional: Product **TrueHz Pro** · one-time **$19** · copy Price ID → `STRIPE_PRICE_ID`  
3. After pay, app returns to `/?checkout=success&session_id=…`, verifies via `/api/verify-checkout-session`, unlocks Pro on that browser  

**API:** `api/create-checkout-session.js`, `api/verify-checkout-session.js`  

**Local API:** use `vercel dev` (plain `npm run dev` is UI-only).

### Playlist import

| Source | How |
|--------|-----|
| **M3U / M3U8** | Playlists tab → **Choose M3U…** — matches paths/titles to Library |
| **Spotify** | Playlists tab → **Connect Spotify** → pick a playlist — matches **metadata only** to Library |

Spotify never streams or retunes in-app. Copy `.env.example` → `.env` and set `VITE_SPOTIFY_CLIENT_ID`.

In the [Spotify Dashboard](https://developer.spotify.com/dashboard), Redirect URI must be **secure per Spotify rules**:
- Dev: `http://127.0.0.1:5173/` (**not** `localhost` — Spotify rejects it)
- Prod: `https://your-domain/`

Open the app at **http://127.0.0.1:5173/** so the redirect matches.

## Mobile (App Store + Google Play)

Native shells use **Capacitor** (`ios/`, `android/`). Full guide: **[MOBILE.md](./MOBILE.md)**.

```bash
npm run mobile:sync      # web build → native projects
npm run mobile:ios       # open Xcode
npm run mobile:android   # open Android Studio
```

App ID: `com.playin432.app` · Name: **Play In 432**

## Project layout

```
src/
  lib/brand.ts           Product / TrueHz brand constants
  lib/learnContent.ts    Learn / science articles (honest claims)
  components/LearnView.tsx
  lib/db.ts              IndexedDB: tracks, playlists, settings
  lib/playerEngine.ts    Web Audio + SoundTouch retune engine
  lib/exportRetune.ts    HQ export (Rubber Band) + SoundTouch fallback
  lib/native.ts          Capacitor status bar / deep links
  workers/rubberbandWorker.ts  TrueHz Convert Rubber Band WASM worker
  lib/pitchDetect.ts     Concert-A estimate
  lib/mediaSession.ts    OS media keys
  lib/mediaTags.ts       ID3 / artwork
  hooks/                 Library + player controllers
  components/            Track list, modals
  App.tsx                Shell + Player / Library / Playlists / Learn
```

## Engines (one product)

| Path | Engine | When |
|------|--------|------|
| Live play | SoundTouch | Instant A/B, scrubbing |
| **Download HQ WAV** | **Rubber Band** (TrueHz Convert) | Keepable file, best music quality |
| Fallback | SoundTouch offline | If WASM/worker fails |

Optional **TrueHz pure-tone bed** (exact target Hz sine) can be mixed into the HQ file when the bed toggle is on.

Rubber Band Library is GPLv2; commercial closed-source distribution may require a separate Rubber Band commercial license from Breakfast Quay.

## Honest claims

- **Retune** = whole-mix reference pitch shift (e.g. A=440 → A=432, −31.8 ¢).
- **Not** a claim that every peak in a mixed song is “exactly 432.00 Hz.”
- Only the optional **TrueHz pure-tone bed** is a true generated sine at the labeled Hz.
- **Download HQ** uses TrueHz Convert (Rubber Band) inside this app — same brand, higher quality file.

## Scripts

- `npm run dev` — local dev server  
- `npm run build` — production build  
- `npm run preview` — serve build  
- `npm test` — unit tests (vitest)  
- `npm run test:e2e` — Playwright smoke (builds + serves preview)  
- `npm run guard:server-only` — fail if `src/` imports the server-only `stripe` SDK  
