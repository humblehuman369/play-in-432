import { defineConfig } from "vitest/config";

// Unit tests only. Playwright e2e specs live in test/e2e and are run by
// Playwright, not vitest — so they are excluded here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/unit/**/*.test.ts"],
  },
});
