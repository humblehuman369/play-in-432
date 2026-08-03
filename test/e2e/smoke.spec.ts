import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "test-tone.mp3",
);

// Landing → player → import → Library → retune control → export reachable.
test("import a track and reach the HQ export control", async ({ page }) => {
  await page.goto("/");

  // Landing renders and offers a way into the player.
  const openPlayer = page.getByRole("button", { name: /open player/i }).first();
  await expect(openPlayer).toBeVisible();
  await openPlayer.click();

  // UX-2 empty state: how-it-works shown, secondary controls collapsed.
  await expect(page.getByText(/how it works/i)).toBeVisible();
  await expect(
    page.getByRole("group", { name: /target frequency anchors/i }),
  ).toHaveCount(0);

  // Import the fixture MP3 via the Library tab's file input.
  await page.getByRole("tab", { name: /library/i }).click();
  await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);

  // The imported track appears (Library count + the track itself). Import
  // auto-loads it into the player.
  await expect(page.getByText(/test-tone/i).first()).toBeVisible({
    timeout: 20_000,
  });

  // Retune target control is present on the player.
  await page.getByRole("tab", { name: /player/i }).click();
  await expect(
    page.getByRole("group", { name: /target frequency anchors/i }),
  ).toBeVisible();

  // HQ export button is reachable and enabled now that a track is active.
  const download = page.getByRole("button", { name: /download hq/i });
  await expect(download).toBeVisible();
  await expect(download).toBeEnabled();
});
