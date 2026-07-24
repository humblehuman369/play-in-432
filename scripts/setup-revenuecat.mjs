#!/usr/bin/env node
/**
 * Configure RevenueCat project for Play In 432 via REST API v2.
 *
 * Usage:
 *   export REVENUECAT_SECRET_API_KEY='sk_...'   # V2 secret key with project write
 *   node scripts/setup-revenuecat.mjs
 *
 * Optional:
 *   REVENUECAT_PROJECT_ID=proj...   # reuse existing project
 *   REVENUECAT_APP_ID=app...        # reuse existing iOS app
 */
import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SECRET = process.env.REVENUECAT_SECRET_API_KEY?.trim();
if (!SECRET) {
  console.error("Set REVENUECAT_SECRET_API_KEY (V2 secret key from dashboard)");
  process.exit(1);
}

const PRODUCTS = [
  {
    store_identifier: "com.playin432.app.truehz_pro",
    type: "non_consumable",
    display_name: "TrueHz Pro Lifetime",
  },
  {
    store_identifier: "com.playin432.app.truehz_pro.monthly",
    type: "subscription",
    display_name: "TrueHz Pro Monthly",
    duration: "P1M",
  },
  {
    store_identifier: "com.playin432.app.truehz_pro.yearly",
    type: "subscription",
    display_name: "TrueHz Pro Yearly",
    duration: "P1Y",
  },
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

async function main() {
  // List projects
  let r = await request("GET", "/v2/projects");
  console.log("projects", r.status, r.raw.slice(0, 500));
  if (r.status === 401 || r.status === 403) {
    console.error("Auth failed — use a V2 Secret API key with project permissions.");
    process.exit(1);
  }

  let projectId = process.env.REVENUECAT_PROJECT_ID?.trim();
  const projects = r.json?.items || r.json?.data || [];
  if (!projectId && Array.isArray(projects) && projects.length) {
    const found =
      projects.find((p) => /play.?in.?432|truehz/i.test(p.name || p.id || "")) ||
      projects[0];
    projectId = found.id;
    console.log("Using project", found.name || found.id, projectId);
  }

  if (!projectId) {
    // Create project if API supports it
    r = await request("POST", "/v2/projects", {
      name: "Play In 432",
    });
    console.log("create project", r.status, r.raw.slice(0, 800));
    if (r.status >= 400) {
      console.error(
        "Could not create/list projects. Create a project in the dashboard, then set REVENUECAT_PROJECT_ID.",
      );
      process.exit(1);
    }
    projectId = r.json.id;
  }

  // Create or find iOS app
  r = await request("GET", `/v2/projects/${projectId}/apps`);
  console.log("apps", r.status, r.raw.slice(0, 600));
  let apps = r.json?.items || r.json?.data || [];
  let app =
    apps.find((a) => a.bundle_id === "com.playin432.app" || a.type === "app_store") ||
    apps[0];

  if (!app) {
    r = await request("POST", `/v2/projects/${projectId}/apps`, {
      name: "Play In 432 iOS",
      type: "app_store",
      app_store: { bundle_id: "com.playin432.app" },
    });
    // try alternate shapes
    if (r.status >= 400) {
      r = await request("POST", `/v2/projects/${projectId}/apps`, {
        name: "Play In 432 iOS",
        type: "app_store",
        bundle_id: "com.playin432.app",
      });
    }
    console.log("create app", r.status, r.raw.slice(0, 800));
    if (r.status < 300) app = r.json;
  } else {
    console.log("Using app", app.id, app.name || app.type);
  }

  const appId = app?.id || process.env.REVENUECAT_APP_ID;
  if (!appId) {
    console.error("No app id — create iOS app in dashboard with bundle com.playin432.app");
    process.exit(1);
  }

  // Create products
  const productIds = [];
  for (const p of PRODUCTS) {
    const body = {
      store_identifier: p.store_identifier,
      type: p.type,
      app_id: appId,
      display_name: p.display_name,
    };
    if (p.duration) {
      body.subscription = { duration: p.duration };
    }
    r = await request("POST", `/v2/projects/${projectId}/products`, body);
    console.log("product", p.store_identifier, r.status, r.status < 300 ? r.json?.id : r.raw.slice(0, 400));
    if (r.status < 300 && r.json?.id) productIds.push(r.json.id);
    else if (r.status === 409 || (r.raw || "").includes("already")) {
      // list and find
      const list = await request("GET", `/v2/projects/${projectId}/products`);
      const items = list.json?.items || [];
      const existing = items.find((x) => x.store_identifier === p.store_identifier);
      if (existing) productIds.push(existing.id);
    }
  }

  // Entitlement truehz_pro
  r = await request("POST", `/v2/projects/${projectId}/entitlements`, {
    lookup_key: "truehz_pro",
    display_name: "TrueHz Pro",
  });
  console.log("entitlement", r.status, r.status < 300 ? r.json?.id : r.raw.slice(0, 500));
  let entitlementId = r.json?.id;
  if (!entitlementId) {
    const list = await request("GET", `/v2/projects/${projectId}/entitlements`);
    const items = list.json?.items || [];
    const e = items.find((x) => x.lookup_key === "truehz_pro" || x.lookup_key === "pro");
    entitlementId = e?.id;
    console.log("existing entitlement", entitlementId);
  }

  // Attach products to entitlement
  if (entitlementId) {
    for (const pid of productIds) {
      r = await request(
        "POST",
        `/v2/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`,
        { product_ids: [pid] },
      );
      // alternate
      if (r.status >= 400) {
        r = await request(
          "POST",
          `/v2/projects/${projectId}/entitlements/${entitlementId}/products`,
          { product_id: pid },
        );
      }
      console.log("attach product", pid, r.status, r.status < 300 ? "OK" : r.raw.slice(0, 300));
    }
  }

  // Offering default
  r = await request("POST", `/v2/projects/${projectId}/offerings`, {
    lookup_key: "default",
    display_name: "Default",
    is_current: true,
  });
  console.log("offering", r.status, r.status < 300 ? r.json?.id : r.raw.slice(0, 500));
  let offeringId = r.json?.id;
  if (!offeringId) {
    const list = await request("GET", `/v2/projects/${projectId}/offerings`);
    const items = list.json?.items || [];
    offeringId = items.find((o) => o.lookup_key === "default" || o.is_current)?.id || items[0]?.id;
  }

  // Packages — API varies; print instructions if fails
  if (offeringId && productIds.length) {
    for (const [i, pid] of productIds.entries()) {
      const lookup = i === 0 ? "lifetime" : i === 1 ? "monthly" : "yearly";
      r = await request("POST", `/v2/projects/${projectId}/packages`, {
        lookup_key: lookup,
        display_name: lookup,
        position: i + 1,
        offering_id: offeringId,
      });
      console.log("package", lookup, r.status, r.status < 300 ? r.json?.id : r.raw.slice(0, 300));
      if (r.status < 300 && r.json?.id) {
        const pkgId = r.json.id;
        r = await request(
          "POST",
          `/v2/projects/${projectId}/packages/${pkgId}/actions/attach_products`,
          { product_ids: [pid] },
        );
        console.log("  attach to package", r.status, r.status < 300 ? "OK" : r.raw.slice(0, 300));
      }
    }
  }

  // List public API keys if endpoint exists
  r = await request("GET", `/v2/projects/${projectId}/api_keys`);
  console.log("api_keys", r.status, r.raw.slice(0, 800));

  const out = {
    projectId,
    appId,
    entitlementId,
    offeringId,
    productIds,
    note: "Copy public appl_ / goog_ keys from dashboard into .env if not listed above",
  };
  fs.writeFileSync(
    path.join(ROOT, ".secrets/revenuecat-setup.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("\nWrote .secrets/revenuecat-setup.json");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
