import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readSourceConfig,
  productionConfig,
  assertProductionBuild,
  runtimeSecrets,
  wranglerEnvironment,
} from "./configure-production.mjs";
const source = readSourceConfig();
source.vars.VIDEO_API_URL = "http://127.0.0.1:8430";
source.d1_databases[0].database_id = "00000000-0000-0000-0000-000000000000";
source.env.production.d1_databases[0].database_id =
  "11111111-2222-3333-4444-555555555555";
source.env.production.vars.VIDEO_API_URL = "https://video.example.test/";

test("production uses wrangler configuration without GitHub variables and retains development bindings", () => {
  const config = productionConfig(source);
  assert.deepEqual(config.d1_databases, source.d1_databases);
  assert.equal(config.vars.VIDEO_API_URL, source.vars.VIDEO_API_URL);
  assert.equal(
    config.env.production.d1_databases[0].database_id,
    source.env.production.d1_databases[0].database_id,
  );
  assert.equal(
    config.env.production.vars.VIDEO_API_URL,
    "https://video.example.test",
  );
  assert.deepEqual(config.env.production.routes, source.env.production.routes);
  assert.equal(config.env.production.workers_dev, false);
  assert.equal(config.env.production.preview_urls, false);
  assert.equal(
    source.env.production.vars.VIDEO_API_URL,
    "https://video.example.test/",
  );
  assert.equal(
    productionConfig(readSourceConfig()).env.production.vars.VIDEO_API_URL,
    "https://api-proxy-tool.veobible.com",
  );
});

test("placeholder database IDs, local URLs and credential-bearing URLs cannot be deployed", () => {
  for (const id of ["00000000-0000-0000-0000-000000000000", "invalid"]) {
    const invalid = structuredClone(source);
    invalid.env.production.d1_databases[0].database_id = id;
    assert.throws(() => productionConfig(invalid), /database_id/);
  }
  for (const url of [
    "http://video.example.test",
    "https://localhost",
    "https://127.0.0.1",
    "https://api.example.com",
    "https://user:pass@video.example.test",
    "https://video.example.test?token=secret",
  ]) {
    const invalid = structuredClone(source);
    invalid.env.production.vars.VIDEO_API_URL = url;
    assert.throws(() => productionConfig(invalid), /VIDEO_API_URL/);
  }
  const invalid = structuredClone(source);
  invalid.env.production.routes[0].pattern = "https://dash.veobible.com";
  assert.throws(() => productionConfig(invalid), /bare hostname/);
});

test("deploying a development or stale generated configuration is rejected", () => {
  const config = productionConfig(source);
  assertProductionBuild(config.env.production, config);
  for (const override of [
    { name: "veobible-dashboard-dev" },
    { vars: source.vars },
    { d1_databases: source.d1_databases },
    { workers_dev: true },
    { routes: [] },
  ]) {
    assert.throws(
      () =>
        assertProductionBuild(
          { ...config.env.production, ...override },
          config,
        ),
      /build:production/,
    );
  }
});

test("runtime secrets require signing and generation credentials and never reuse the deployment token for publishing", () => {
  const env = {
    DASHBOARD_CLOUDFLARE_ACCOUNT_ID: "test-account",
    DASHBOARD_CLOUDFLARE_API_TOKEN: "deploy-token",
    DASHBOARD_JWT_SECRET: "j".repeat(32),
    DASHBOARD_PROXY_API_TOKEN: "v".repeat(32),
  };
  assert.throws(() => runtimeSecrets({}), /Missing deployment/);
  assert.throws(
    () => runtimeSecrets({ ...env, DASHBOARD_JWT_SECRET: "short" }),
    /32 bytes/,
  );
  assert.deepEqual(runtimeSecrets(env), {
    JWT_SECRET: env.DASHBOARD_JWT_SECRET,
    PROXY_API_TOKEN: env.DASHBOARD_PROXY_API_TOKEN,
  });
  assert.deepEqual(
    runtimeSecrets({
      ...env,
      DASHBOARD_PUBLISH_API_TOKEN: "read-only-publish-token",
    }),
    {
      JWT_SECRET: env.DASHBOARD_JWT_SECRET,
      PROXY_API_TOKEN: env.DASHBOARD_PROXY_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: "test-account",
      CLOUDFLARE_API_TOKEN: "read-only-publish-token",
    },
  );
});

test("deployment credentials are app-scoped and override unrelated monorepo credentials", () => {
  const credentials = {
    DASHBOARD_CLOUDFLARE_ACCOUNT_ID: "dashboard-account",
    DASHBOARD_CLOUDFLARE_API_TOKEN: "dashboard-token",
    CLOUDFLARE_ACCOUNT_ID: "other-account",
    CLOUDFLARE_API_TOKEN: "other-token",
  };
  const mapped = wranglerEnvironment(credentials);
  assert.equal(mapped.CLOUDFLARE_ACCOUNT_ID, "dashboard-account");
  assert.equal(mapped.CLOUDFLARE_API_TOKEN, "dashboard-token");
  assert.throws(
    () =>
      wranglerEnvironment({
        CLOUDFLARE_ACCOUNT_ID: "other-account",
        CLOUDFLARE_API_TOKEN: "other-token",
      }),
    /DASHBOARD_CLOUDFLARE_ACCOUNT_ID/,
  );
  assert.equal(credentials.CLOUDFLARE_API_TOKEN, "other-token");
});
