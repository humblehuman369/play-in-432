# Play In 432 — UI/UX Review Context

Handoff note to seed a design-focused chat. Read this first, then the key
components below, before proposing changes.

## App at a glance
- **Stack:** Vite + React 19 + TypeScript. Also ships as iOS/Android via Capacitor.
- **Repo:** `/Users/bradgeisen/play-in-432`. Branch **`main` = production**, auto-deploys to **playin432.com** via Vercel.
- **Product:** *Play In 432* — a private, on-device player that retunes music files you **own** to A=432 (and other targets). Files never leave the device (IndexedDB). Tech/brand layer: **TrueHz™**. Parent brand: Rise In Harmony.
- **Tiers:** Free + **Lite ($9.99)** + **Pro ($19)**, one-time (Stripe on web, StoreKit IAP on iOS).

## Design language / tokens (`src/App.css` `:root`)
Dark theme, one large stylesheet (~4,145 lines):
- `--bg: #070b0f` (near-black) · `--panel: rgba(12,20,24,.85)`
- `--text: #e8f7f3` (near-white) · `--muted: #8aa8a0` (grey — **contrast suspect**)
- `--accent: #00d4aa` (teal) · `--gold: #e8c47c` · `--border: rgba(255,255,255,.06)` · `--danger: #ff7b7b`

## Key components (where to look)
- `src/components/LandingView.tsx` — marketing landing: hero, "How do you want to start?" cards, offers, steps, for/not-for, FAQ, "not another Spotify app" comparison, bottom CTA. Renders `PricingSection`.
- `src/components/PricingSection.tsx` — Free/Lite/Pro pricing cards + gift + restore.
- `src/components/UpgradeModal.tsx` — upgrade gate; **two side-by-side Lite/Pro cards**, Pro pre-highlighted.
- `src/components/FrequencyStrip.tsx` — target-frequency chips (a `role="group"` of `aria-pressed` toggle buttons).
- `src/components/TrackList.tsx` — track rows: play, favorite, more-menu, drag + **keyboard move up/down** reorder.
- `src/components/Modal.tsx` — generic modal shell.
- `src/App.tsx` — top-level shell (~2,000 lines): landing vs app shells; tabs Player/Library/Playlists/Learn/Share; player transport, seek, HQ export, empty-state.
- Also: `HearTheDifference` (A/B tone), `MoodGuide`, `SleepTimer`, `BatchExportPanel` (Pro), `LearnView`, `ShareDemoView`.

## Recently shipped (R5 + follow-ups) — this is the starting point, not a blank slate
- Two-card Lite/Pro upgrade modal.
- **Empty-state player:** with no tracks, show dropzone hero + a single "how it works" line; secondary controls (frequency strip, A/B, mood guide, sleep timer) collapse until first import.
- FrequencyStrip: listbox→group with `aria-pressed` + explicit `aria-label`s.
- Playlist rows: keyboard move-up/down buttons (alternative to drag).
- `prefers-reduced-motion` added (glow/pulse/spin animations).
- Landing "How to start" is now **two centered cards** (Spotify card removed).
- Unlock-code labeling; post-purchase "You're unlocked" modal.

## Open accessibility gate — UNRUN (natural first tasks)
Code is in place; these verifications were never run:
1. **Lighthouse Accessibility ≥ 95** on landing + app (Chrome DevTools → Lighthouse).
2. **VoiceOver pass** (macOS ⌘F5) — manual screen-reader walkthrough of import → retune → export.
3. **Grey-on-dark contrast audit** — verify text tokens meet WCAG (4.5:1 normal / 3:1 large). Scrutinize `--muted` (#8aa8a0) and teal/gold text on `--bg`/`--panel`; enumerate failures via axe/Lighthouse or computed ratios, then nudge failing colors.

## Recent product context
- **Spotify removed** entirely (streaming audio is DRM-locked, can't be retuned) → replaced with a "buy DRM-free downloads (iTunes Store / Amazon MP3 / Bandcamp) → Add music" pointer. No OAuth/SDK.
- **HQ export engine** swapped GPL Rubber Band → **MIT Signalsmith Stretch** (live); SoundTouch is the fallback.
- iOS **build 10** is in App Store review (v1.0).

## Working rules
- **Verify:** `npm run build` · `npm run lint` · `npm test` (vitest unit) · `npx playwright test` (e2e; run `npx playwright install chromium` first if the browser is missing).
- **`main` is production.** Do NOT push/merge to `main` or deploy without explicit approval — work on a branch.
- Preserve the dark / TrueHz teal identity unless asked otherwise.
