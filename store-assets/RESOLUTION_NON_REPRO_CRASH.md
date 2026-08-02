# Resolution Center reply — crash not reproducible

Paste into App Store Connect when Apple reports a crash you cannot reproduce.

```
Hello App Review Team,

Thank you for the crash report regarding “Take image from camera” on iPad Air 11-inch (M3) / iPadOS.

We were unable to reproduce a crash in the app’s intended review path. Play In 432 is a music retune app and does not use the camera as a product feature.

What we found and fixed
• Core import is audio-only (MP3, WAV, FLAC, M4A, etc.). Photos and videos are rejected in code.
• On iPad, the system file picker can still offer “Take Photo” even when the app requests audio. If that path was used, iOS may have terminated the process when camera privacy strings were missing.
• We added the appropriate Info.plist usage descriptions so the system cannot kill the app if Camera appears, and we still discard non-audio files with a clear error message.
• We hardened import (per-file error handling) so a bad file cannot crash the library pipeline.
• We re-tested: Add music → choose an audio file from Files → free A=440 → A=432 playback. No crash.

How to review without camera (recommended)
1. Launch the app.
2. Tap “Add music files” or “Open player.”
3. When the system picker appears, choose Files and select any short MP3/WAV — do not use Take Photo.
4. Play with free 440 → 432 retune.

There is no Login/Register account flow. Free use requires no purchase.
In-App Purchases (Lite/Pro) use StoreKit when testing paid features with a Sandbox account.

We believe this addresses the crash. The new binary includes the privacy strings and import hardening. Please retest with an audio file from Files on iPad.

If a crash persists, please share the fully symbolicated crash log for the new build number so we can match it precisely.

Thank you,
Brad Geisen
Rise In Harmony / Play In 432
brad@geisen.cc
```
