# Apply the TrueHz Convert engine swap

Files in this delivery:
1. `exportSignalsmith.ts` → copy to `src/lib/exportSignalsmith.ts`
2. `signalsmith-stretch.d.ts` → copy to `src/types/signalsmith-stretch.d.ts`
3. This file — the four surgical edits to `src/lib/exportRetune.ts`, plus install, copy updates, and the verification gate.

Rubber Band code stays in place (unreferenced by the HQ path) until the
A/B gate passes. Removal is a separate deletion-only PR at the end.

---

## Step 0 — Install

```bash
npm install signalsmith-stretch
npm run build   # confirm clean TS build after the file copies + edits below
```

## Step 1 — Copy the two new files

```bash
cp exportSignalsmith.ts        src/lib/exportSignalsmith.ts
mkdir -p src/types
cp signalsmith-stretch.d.ts    src/types/signalsmith-stretch.d.ts
```

If `tsc` cannot see the module declaration, add `"src/types"` to
`typeRoots` or confirm `include` in tsconfig.app.json covers `src` (it does
in the current repo).

## Step 2 — Four edits to `src/lib/exportRetune.ts`

These are exact old → new blocks against current main. Apply in order.

### Edit 1 — header comment

OLD:
```ts
 * Live preview → SoundTouch (playerEngine)
 * HQ download → TrueHz Convert engine (Rubber Band WASM offline)
 * Fallback → SoundTouch offline if Rubber Band fails
```
NEW:
```ts
 * Live preview → SoundTouch (playerEngine)
 * HQ download → TrueHz Convert engine (Signalsmith Stretch, MIT)
 * Fallback → SoundTouch offline if the HQ engine fails
```

### Edit 2 — import + engine union

OLD:
```ts
import { BRAND } from "./brand";
import type { ExportFormat } from "./types";
```
NEW:
```ts
import { BRAND } from "./brand";
import { renderRetunedSignalsmith } from "./exportSignalsmith";
import type { ExportFormat } from "./types";
```

OLD:
```ts
export type ExportEngine = "rubberband" | "soundtouch";
```
NEW:
```ts
export type ExportEngine = "signalsmith" | "rubberband" | "soundtouch";
```

("rubberband" stays in the union until the removal PR so the old function
still type-checks.)

### Edit 3 — swap the primary engine in `renderRetunedHq()`

OLD:
```ts
  try {
    onProgress?.(0.01, `${BRAND.convertProduct} · Rubber Band HQ`);
    const rendered = await renderRetunedRubberBand(
      buffer,
      sourceA,
      targetA,
      onProgress,
      style,
    );
    return { buffer: rendered, engine: "rubberband", usedFallback: false };
  } catch (e) {
    console.warn("[TrueHz Convert] Rubber Band failed, using SoundTouch:", e);
    onProgress?.(0.05, "Rubber Band unavailable — using preview-quality engine");
```
NEW:
```ts
  try {
    onProgress?.(0.01, `${BRAND.convertProduct} · HQ`);
    const rendered = await renderRetunedSignalsmith(
      buffer,
      sourceA,
      targetA,
      onProgress,
      style,
    );
    return { buffer: rendered, engine: "signalsmith", usedFallback: false };
  } catch (e) {
    console.warn("[TrueHz Convert] HQ engine failed, using SoundTouch:", e);
    onProgress?.(0.05, "HQ engine unavailable — using preview-quality engine");
```

(The SoundTouch fallback block below it is unchanged. This also removes the
third-party engine name from user-facing status text — TrueHz Convert is
the brand users see.)

### Edit 4 — filename tag in `retunedDownloadName()`

OLD:
```ts
  const tag = engine === "rubberband" ? "TrueHz-HQ" : "preview";
```
NEW:
```ts
  const tag = engine === "soundtouch" ? "preview" : "TrueHz-HQ";
```

## Step 3 — Sweep user-facing copy

```bash
grep -rni "rubber band\|rubberband" src/ index.html
```

Expected non-code hits to reword to "TrueHz Convert" (no engine name):
- Learn article "Live preview vs high-quality export" (src/lib/learnContent.ts)
- Landing page "What you get" card: "Download high-quality offline WAV with
  Rubber Band — not a cheap real-time dump."
- Any export-modal / paywall copy in App.tsx or components.

Leave README.md alone for now; it gets rewritten in the removal PR.

## Step 4 — Licenses screen (MIT notice requirement)

Add or extend an open-source credits section (About/Learn footer is fine):

> Signalsmith Stretch © Signalsmith Audio (Geraint Luff) — MIT License

While there, list existing deps: React (MIT), SoundTouchJS (LGPL-2.1),
lamejs (LGPL), fflate (MIT), music-metadata (MIT), lucide-react (ISC).
This satisfies the only obligation MIT imposes.

## Step 5 — Verification gate (must pass before the removal PR)

Mechanical checks first:
1. `npm run build` clean; `npm run lint` clean.
2. Export a 440→432 WAV of any track. Confirm:
   - file duration exactly matches the original (sample count check),
   - no silence/click in the first 200 ms (latency trim proof — compare
     waveform head against the Rubber Band export of the same file),
   - open in a tuner/spectrum tool: A4 lands at ~432.0 Hz, proving the
     fractional −0.318 st shift was applied (not a rounded semitone).
3. MP3 export path once (shares the buffer, should just work).
4. Bed toggle on: exact sine present, no clipping (bed mixer unchanged).
5. Batch export (Pro): two tracks, ZIP arrives, filenames end `_TrueHz-HQ`.
6. Kill test: temporarily rename the package import to force a throw and
   confirm the SoundTouch fallback still fires with the "preview" filename.

Listening A/B (blind, level-matched, WAV, same sources both engines):
440→432, 440→444, 440→528, 440→174 (Concert A), 440→963 (Concert A),
440→963 (Re-anchor). Sources: one dense pop/rock mix, one solo vocal, one
solo piano, one long meditation track.

Device checks:
- iOS Safari / Capacitor WebView: 60-minute track export on BOTH engines.
  Record the result for the current build too — this measures the
  pre-existing memory ceiling, not just the new engine.
- Rough timing of a 5-minute export on desktop + iPhone, both engines.
  If Signalsmith is >2× slower on iPhone, stop and reassess (published
  comparisons say it should be equal or faster).

## Step 6 — Removal PR (only after Step 5 sign-off)

Pure deletion, no behavior change:
- delete `src/workers/rubberbandWorker.ts`
- delete `renderRetunedRubberBand` and `runRubberBandWorker` and the
  worker-type imports from exportRetune.ts
- `npm uninstall rubberband-wasm`
- drop `"rubberband"` from ExportEngine
- README: update the Engines table (Live: SoundTouch · HQ: Signalsmith
  Stretch (MIT) · Fallback: SoundTouch) and delete the GPL caveat paragraph

## Known runtime unknowns (checked by Step 5, guarded in code)

- Default-export shape: package.json maps import → SignalsmithStretch.mjs.
  If the build errors on the default import, switch to
  `import * as SS from "signalsmith-stretch"` and call `SS.default ?? SS`.
- Latency compensation exactness: code schedules ahead by `node.latency()`
  and trims that lead; check 5.2's waveform-head comparison catches any
  residual offset. If a constant offset shows up, adjust the trim by the
  measured frames and comment the value.
- Future CSP note: the worklet loads from a blob/data URL. If the CSP from
  the audit report ships later, it needs `worker-src 'self' blob:`.
