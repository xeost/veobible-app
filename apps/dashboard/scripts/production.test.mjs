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
source.env.production.d1_databases[0].database_id =
  "00000000-0000-0000-0000-000000000000";
source.env.production.vars.VIDEO_API_URL = "https://video-api.example.com";
const environment = {
  DASHBOARD_D1_DATABASE_ID: "11111111-2222-3333-4444-555555555555",
  DASHBOARD_VIDEO_API_URL: "https://video.example.test/",
};

test("production configuration retains local bindings and targets the dashboard domain and dedicated database", () => {
  const config = productionConfig(source, environment);
  assert.deepEqual(config.d1_databases, source.d1_databases);
  assert.equal(
    productionConfig(readSourceConfig(), {
      DASHBOARD_D1_DATABASE_ID: environment.DASHBOARD_D1_DATABASE_ID,
    }).env.production.vars.VIDEO_API_URL,
    "https://api-proxy-tool.veobible.com",
  );
  assert.equal(config.vars.VIDEO_API_URL, "http://127.0.0.1:8430");
  assert.equal(
    config.env.production.d1_databases[0].database_id,
    environment.DASHBOARD_D1_DATABASE_ID,
  );
  assert.equal(
    config.env.production.vars.VIDEO_API_URL,
    "https://video.example.test",
  );
  assert.deepEqual(config.env.production.routes, [
    { pattern: "dash.veobible.com", custom_domain: true },
  ]);
  assert.equal(config.env.production.workers_dev, false);
  assert.equal(config.env.production.preview_urls, false);
  assert.equal(
    source.env.production.d1_databases[0].database_id,
    "00000000-0000-0000-0000-000000000000",
  );
});

test("missing production values, local URLs and credential-bearing URLs cannot be deployed", () => {
  assert.throws(() => productionConfig(source, {}), /DASHBOARD_D1_DATABASE_ID/);
  assert.throws(
    () =>
      productionConfig(source, {
        ...environment,
        DASHBOARD_D1_DATABASE_ID: "invalid",
      }),
    /DASHBOARD_D1_DATABASE_ID/,
  );
  for (const url of [
    "http://video.example.test",
    "https://localhost",
    "https://127.0.0.1",
    "https://api.example.com",
    "https://user:pass@video.example.test",
    "https://video.example.test?token=secret",
  ]) {
    assert.throws(
      () =>
        productionConfig(source, {
          ...environment,
          DASHBOARD_VIDEO_API_URL: url,
        }),
      /DASHBOARD_VIDEO_API_URL/,
    );
  }
  assert.throws(
    () =>
      productionConfig(source, {
        ...environment,
        DASHBOARD_DOMAIN: "https://dash.veobible.com",
      }),
    /bare hostname/,
  );
});

test("deploying a development or stale generated configuration is rejected", () => {
  const config = productionConfig(source, environment);
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
