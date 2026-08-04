import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "test-tone.mp3",
);

// Proves the Signalsmith HQ engine actually runs in a real browser and
// produces a valid WAV — not the SoundTouch fallback. The filename tag is the
// tell: Signalsmith success -> "_TrueHz-HQ.wav"; a fallback -> "_preview.wav".
test("HQ export runs the Signalsmith engine and downloads a WAV", async ({
  page,
}) => {
  const fellBack: string[] = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/HQ engine failed|SoundTouch fallback|preview-quality/i.test(t)) {
      fellBack.push(t);
    }
  });

  await page.goto("/");
  await page.getByRole("button", { name: /open player/i }).first().click();
  await page.getByRole("tab", { name: /library/i }).click();
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  await expect(page.getByText(/test-tone/i).first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("tab", { name: /player/i }).click();
  const download = page.getByRole("button", { name: /download hq/i });
  await expect(download).toBeEnabled();

  const dl = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    download.click(),
  ]).then(([d]) => d);

  const filename = dl.suggestedFilename();
  // Signalsmith produced the HQ file (would be "_preview.wav" on fallback).
  expect(filename, `engine fallback? console: ${fellBack.join(" | ")}`).toMatch(
    /_TrueHz-HQ\.wav$/,
  );
  expect(fellBack, "HQ engine should not have fallen back").toHaveLength(0);

  // The WAV is real (bigger than a bare 44-byte header).
  const saved = await dl.path();
  expect(saved).toBeTruthy();
  const bytes = fs.statSync(saved as string).size;
  expect(bytes).toBeGreaterThan(1000);
});
