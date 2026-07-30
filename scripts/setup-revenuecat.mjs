#!/usr/bin/env node
/**
 * Configure RevenueCat project for Play In 432 via REST API v2.
 *
 * Creates / reuses:
 *   - Project (Play In 432)
 *   - iOS app (bundle com.playin432.app)
 *   - Products: Lite + Pro lifetime (+ optional monthly/yearly)
 *   - Entitlements: truehz_lite, truehz_pro
 *   - Offering: default (current) with packages lite, lifetime, monthly, yearly
 *   - Writes public API keys hint to .secrets/revenuecat-setup.json
 *
 * Usage:
 *   export REVENUECAT_SECRET_API_KEY='sk_…'   # V2 secret with project_configuration write
 *   node scripts/setup-revenuecat.mjs
 *
 * Optional:
 *   REVENUECAT_PROJECT_ID=proj…
 *   REVENUECAT_APP_ID=app…
 *   REVENUECAT_SKIP_SUBS=1   # only Lite + Pro lifetime
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, ".secrets/revenuecat-setup.json");

const SECRET = process.env.REVENUECAT_SECRET_API_KEY?.trim();
if (!SECRET) {
  console.error(`
Missing REVENUECAT_SECRET_API_KEY.

1. Open https://app.revenuecat.com → Project → API keys
2. + New → Version V2 → permissions:
     project_configuration:apps:read_write
     project_configuration:products:read_write
     project_configuration:entitlements:read_write
     project_configuration:offerings:read_write
3. Generate, then:

   export REVENUECAT_SECRET_API_KEY='sk_…'
   node scripts/setup-revenuecat.mjs
`);
  process.exit(1);
}

const SKIP_SUBS = process.env.REVENUECAT_SKIP_SUBS === "1";

const PRODUCT_DEFS = [
  {
    store_identifier: "com.playin432.app.truehz_lite",
    type: "non_consumable",
    display_name: "TrueHz Lite",
    package_key: "lite",
    entitlement: "truehz_lite",
  },
  {
    store_identifier: "com.playin432.app.truehz_pro",
    type: "non_consumable",
    display_name: "TrueHz Pro Lifetime",
    package_key: "lifetime",
    entitlement: "truehz_pro",
  },
  ...(SKIP_SUBS
    ? []
    : [
        {
          store_identifier: "com.playin432.app.truehz_pro.monthly",
          type: "subscription",
          display_name: "TrueHz Pro Monthly",
          duration: "P1M",
          package_key: "monthly",
          entitlement: "truehz_pro",
        },
        {
          store_identifier: "com.playin432.app.truehz_pro.yearly",
          type: "subscription",
          display_name: "TrueHz Pro Yearly",
          duration: "P1Y",
          package_key: "yearly",
          entitlement: "truehz_pro",
        },
      ]),
];

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : Buffer.from(JSON.stringify(body));
    const headers = {
      Authorization: `Bearer ${SECRET}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (data) headers["Content-Length"] = data.length;
    const req = https.request(
      {
        hostname: "api.revenuecat.com",
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = { raw };
          }
          resolve({ status: res.statusCode, json, raw });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function itemsOf(json) {
  return json?.items || json?.data || [];
}

async function listAll(urlPath) {
  const all = [];
  let path = urlPath.includes("?")
    ? `${urlPath}&limit=50`
    : `${urlPath}?limit=50`;
  for (let i = 0; i < 20; i++) {
    const r = await request("GET", path);
    if (r.status >= 400) return { status: r.status, items: all, raw: r.raw };
    all.push(...itemsOf(r.json));
    const next = r.json?.next_page;
    if (!next) break;
    path = next.startsWith("http")
      ? new URL(next).pathname + new URL(next).search
      : next;
  }
  return { status: 200, items: all };
}

async function ensureEntitlement(projectId, lookupKey, displayName) {
  let r = await request("POST", `/v2/projects/${projectId}/entitlements`, {
    lookup_key: lookupKey,
    display_name: displayName,
  });
  if (r.status < 300 && r.json?.id) {
    console.log(`entitlement ${lookupKey} created`, r.json.id);
    return r.json.id;
  }
  const list = await listAll(`/v2/projects/${projectId}/entitlements`);
  const found = list.items.find(
    (e) => e.lookup_key === lookupKey || e.lookup_key === lookupKey.replace("truehz_", ""),
  );
  if (found) {
    console.log(`entitlement ${lookupKey} exists`, found.id);
    return found.id;
  }
  console.error(`Could not create/find entitlement ${lookupKey}`, r.status, r.raw?.slice?.(0, 400));
  return null;
}

async function ensureProduct(projectId, appId, def) {
  const body = {
    store_identifier: def.store_identifier,
    type: def.type,
    app_id: appId,
    display_name: def.display_name,
  };
  if (def.duration) {
    body.subscription = { duration: def.duration };
  }
  let r = await request("POST", `/v2/projects/${projectId}/products`, body);
  if (r.status < 300 && r.json?.id) {
    console.log(`product ${def.store_identifier} created`, r.json.id);
    return r.json.id;
  }
  // already exists or alternate error
  const list = await listAll(`/v2/projects/${projectId}/products`);
  const existing = list.items.find(
    (x) => x.store_identifier === def.store_identifier,
  );
  if (existing) {
    console.log(`product ${def.store_identifier} exists`, existing.id);
    return existing.id;
  }
  console.error(
    `product ${def.store_identifier} failed`,
    r.status,
    r.raw?.slice?.(0, 500),
  );
  return null;
}

async function attachProducts(projectId, entitlementId, productIds) {
  if (!entitlementId || !productIds.length) return;
  // Prefer bulk attach
  let r = await request(
    "POST",
    `/v2/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`,
    { product_ids: productIds },
  );
  if (r.status < 300) {
    console.log(`  attached ${productIds.length} products → entitlement OK`);
    return;
  }
  for (const pid of productIds) {
    r = await request(
      "POST",
      `/v2/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`,
      { product_ids: [pid] },
    );
    console.log(
      `  attach ${pid}`,
      r.status < 300 ? "OK" : r.raw?.slice?.(0, 200),
    );
  }
}

async function ensureOffering(projectId) {
  let r = await request("POST", `/v2/projects/${projectId}/offerings`, {
    lookup_key: "default",
    display_name: "Default",
    is_current: true,
  });
  if (r.status < 300 && r.json?.id) {
    console.log("offering default created", r.json.id);
    return r.json.id;
  }
  const list = await listAll(`/v2/projects/${projectId}/offerings`);
  const found =
    list.items.find((o) => o.lookup_key === "default") ||
    list.items.find((o) => o.is_current) ||
    list.items[0];
  if (found) {
    console.log("offering exists", found.id, found.lookup_key);
    // try mark current
    if (!found.is_current) {
      await request("POST", `/v2/projects/${projectId}/offerings/${found.id}`, {
        is_current: true,
      });
    }
    return found.id;
  }
  console.error("offering failed", r.status, r.raw?.slice?.(0, 400));
  return null;
}

async function ensurePackage(projectId, offeringId, lookupKey, displayName, position, productId) {
  // Create package under offering
  let r = await request(
    "POST",
    `/v2/projects/${projectId}/offerings/${offeringId}/packages`,
    {
      lookup_key: lookupKey,
      display_name: displayName,
      position,
    },
  );
  // fallback paths
  if (r.status >= 400) {
    r = await request("POST", `/v2/projects/${projectId}/packages`, {
      lookup_key: lookupKey,
      display_name: displayName,
      position,
      offering_id: offeringId,
    });
  }
  let packageId = r.json?.id;
  if (!packageId) {
    const list = await listAll(
      `/v2/projects/${projectId}/offerings/${offeringId}/packages`,
    );
    const found = list.items.find((p) => p.lookup_key === lookupKey);
    packageId = found?.id;
    if (packageId) console.log(`package ${lookupKey} exists`, packageId);
  } else {
    console.log(`package ${lookupKey} created`, packageId);
  }
  if (!packageId || !productId) return packageId;

  r = await request(
    "POST",
    `/v2/projects/${projectId}/packages/${packageId}/actions/attach_products`,
    { product_ids: [productId] },
  );
  console.log(
    `  package ${lookupKey} ← product`,
    r.status < 300 ? "OK" : r.raw?.slice?.(0, 250),
  );
  return packageId;
}

async function main() {
  console.log("RevenueCat setup — Play In 432\n");

  let r = await request("GET", "/v2/projects");
  if (r.status === 401 || r.status === 403) {
    console.error("Auth failed. Use a V2 Secret API key with project_configuration permissions.");
    console.error(r.raw?.slice?.(0, 400));
    process.exit(1);
  }

  let projectId = process.env.REVENUECAT_PROJECT_ID?.trim();
  const projects = itemsOf(r.json);
  if (!projectId && projects.length) {
    const found =
      projects.find((p) => /play.?in.?432|truehz/i.test(p.name || "")) ||
      projects[0];
    projectId = found.id;
    console.log("Using project:", found.name || found.id, projectId);
  }
  if (!projectId) {
    r = await request("POST", "/v2/projects", { name: "Play In 432" });
    if (r.status >= 400) {
      console.error("Create project in dashboard, then set REVENUECAT_PROJECT_ID");
      console.error(r.raw?.slice?.(0, 500));
      process.exit(1);
    }
    projectId = r.json.id;
    console.log("Created project", projectId);
  }

  // iOS app
  const appsList = await listAll(`/v2/projects/${projectId}/apps`);
  let app =
    appsList.items.find(
      (a) =>
        a.bundle_id === "com.playin432.app" ||
        a.app_store?.bundle_id === "com.playin432.app" ||
        a.type === "app_store",
    ) || appsList.items[0];

  if (!app) {
    r = await request("POST", `/v2/projects/${projectId}/apps`, {
      name: "Play In 432 iOS",
      type: "app_store",
      app_store: { bundle_id: "com.playin432.app" },
    });
    if (r.status >= 400) {
      console.error("Create iOS app failed", r.raw?.slice?.(0, 600));
      process.exit(1);
    }
    app = r.json;
    console.log("Created iOS app", app.id);
  } else {
    console.log("Using app", app.id, app.name || app.type);
  }
  const appId = process.env.REVENUECAT_APP_ID?.trim() || app.id;

  // Products
  const productByKey = {};
  for (const def of PRODUCT_DEFS) {
    const id = await ensureProduct(projectId, appId, def);
    if (id) productByKey[def.package_key] = { id, def };
  }

  // Entitlements
  const liteEnt = await ensureEntitlement(projectId, "truehz_lite", "TrueHz Lite");
  const proEnt = await ensureEntitlement(projectId, "truehz_pro", "TrueHz Pro");

  const liteIds = Object.values(productByKey)
    .filter((p) => p.def.entitlement === "truehz_lite")
    .map((p) => p.id);
  const proIds = Object.values(productByKey)
    .filter((p) => p.def.entitlement === "truehz_pro")
    .map((p) => p.id);

  console.log("\nAttach entitlements…");
  await attachProducts(projectId, liteEnt, liteIds);
  await attachProducts(projectId, proEnt, proIds);

  // Offering + packages
  console.log("\nOffering…");
  const offeringId = await ensureOffering(projectId);
  if (offeringId) {
    let pos = 1;
    for (const key of ["lite", "lifetime", "monthly", "yearly"]) {
      const entry = productByKey[key];
      if (!entry) continue;
      await ensurePackage(
        projectId,
        offeringId,
        key,
        entry.def.display_name,
        pos++,
        entry.id,
      );
    }
  }

  // Public API keys
  r = await request("GET", `/v2/projects/${projectId}/apps/${appId}/public_api_keys`);
  const keys = itemsOf(r.json);
  console.log("\nPublic API keys:", r.status);
  for (const k of keys) {
    console.log(`  ${k.environment || "?"}  ${k.key || k.id}`);
  }

  const iosPublic =
    keys.find((k) => String(k.key || "").startsWith("appl_"))?.key || null;

  const out = {
    projectId,
    iosAppId: appId,
    offeringId,
    entitlements: {
      truehz_lite: liteEnt,
      truehz_pro: proEnt,
    },
    products: Object.fromEntries(
      Object.entries(productByKey).map(([k, v]) => [
        k,
        { id: v.id, store_identifier: v.def.store_identifier },
      ]),
    ),
    iosPublicApiKey: iosPublic,
    nextSteps: [
      "Put iosPublicApiKey into .env as VITE_REVENUECAT_IOS_API_KEY=appl_…",
      "RevenueCat → Apps → iOS → upload In-App Purchase Key (.p8) from App Store Connect",
      "App Store Connect products must exist (Lite + Pro READY_TO_SUBMIT already)",
      "npm run mobile:sync && test Sandbox purchase on device",
    ],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log("\nWrote", OUT);
  console.log(JSON.stringify(out, null, 2));

  if (iosPublic) {
    // Merge into .env if missing/placeholder
    const envPath = path.join(ROOT, ".env");
    if (fs.existsSync(envPath)) {
      let env = fs.readFileSync(envPath, "utf8");
      if (/^VITE_REVENUECAT_IOS_API_KEY=/m.test(env)) {
        env = env.replace(
          /^VITE_REVENUECAT_IOS_API_KEY=.*$/m,
          `VITE_REVENUECAT_IOS_API_KEY=${iosPublic}`,
        );
      } else {
        env += `\nVITE_REVENUECAT_IOS_API_KEY=${iosPublic}\n`;
      }
      fs.writeFileSync(envPath, env);
      console.log("Updated .env VITE_REVENUECAT_IOS_API_KEY");
    }
  }

  console.log(`
────────────────────────────────────────
Manual (cannot fully automate):
1. RevenueCat dashboard → iOS app → connect App Store with In-App Purchase Key
   (App Store Connect → Users and Access → Integrations → In-App Purchase)
2. Sandbox tester purchase on a device build
3. Attach Lite + Pro IAPs when submitting iOS 1.0
────────────────────────────────────────
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
