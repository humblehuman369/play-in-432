/**
 * CODE-7 guard: the Stripe SDK is server-only (used exclusively under api/).
 * Fail the build if anything under src/ imports "stripe", so it can never be
 * bundled into the client. Run in CI and locally via `npm run guard:server-only`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(fileURLToPath(new URL(".", import.meta.url)), "..", "src");
const IMPORT_STRIPE = /(?:import[^;]*?from\s*|require\(\s*|import\(\s*)["']stripe["']/;
const CODE_EXT = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

const offenders = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (CODE_EXT.test(name) && IMPORT_STRIPE.test(readFileSync(p, "utf8"))) {
      offenders.push(p);
    }
  }
}
walk(SRC);

if (offenders.length) {
  console.error(
    'CODE-7: "stripe" is server-only (api/). Remove these src/ imports:',
  );
  for (const o of offenders) console.error("  " + o);
  process.exit(1);
}
console.log("guard:server-only OK — no stripe imports in src/");
