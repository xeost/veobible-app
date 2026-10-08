import fs from "node:fs";
import { parse } from "jsonc-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const dashboardRoot = fileURLToPath(new URL("../", import.meta.url));
export const sourceConfigPath = path.join(dashboardRoot, "wrangler.jsonc");
export const buildConfigPath = path.join(
  dashboardRoot,
  "dist/server/wrangler.json",
);

export function readSourceConfig() {
  const errors = [];
  const config = parse(fs.readFileSync(sourceConfigPath, "utf8"), errors, {
    allowTrailingComma: true,
  });
  if (errors.length) throw new Error("Invalid wrangler.jsonc configuration.");
  return config;
}

export function productionConfig(source) {
  const config = structuredClone(source);
  const production = config.env.production;
  const database = production.d1_databases.find(
    (binding) => binding.binding === "DB",
  );
  if (
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(
      database.database_id,
    ) ||
    /^0+-0+-0+-0+-0+$/.test(database.database_id)
  ) {
    throw new Error("Set the production D1 database_id in wrangler.jsonc.");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(database.database_name))
    throw new Error("Invalid production database name.");
  const url = new URL(production.vars.VIDEO_API_URL);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /^(localhost|127\.|\[::1\])|(?:^|\.)example\.(com|net|org)$|\.localhost$/i.test(
      url.hostname,
    )
  ) {
    throw new Error(
      "Set the production VIDEO_API_URL in wrangler.jsonc to the HTTPS URL of the proxy tunnel.",
    );
  }
  production.vars.VIDEO_API_URL = url.href.replace(/\/$/, "");
  const domain = production.routes[0].pattern;
  if (
    domain.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)
  )
    throw new Error(
      "The production route in wrangler.jsonc must be a bare hostname.",
    );
  production.routes = [{ pattern: domain, custom_domain: true }];
  production.workers_dev = false;
  production.preview_urls = false;
  return config;
}

export function loadProductionEnvironment() {
  const file = path.join(dashboardRoot, ".env.production");
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

export function assertProductionBuild(build, source) {
  const expected = source.env.production;
  if (
    build.name !== expected.name ||
    build.vars?.VIDEO_API_URL !== expected.vars.VIDEO_API_URL ||
    build.workers_dev !== false ||
    build.preview_urls !== false ||
    JSON.stringify(build.routes) !== JSON.stringify(expected.routes) ||
    build.d1_databases?.find((binding) => binding.binding === "DB")
      ?.database_id !==
      expected.d1_databases.find((binding) => binding.binding === "DB")
        .database_id
  ) {
    throw new Error(
      "The generated Worker configuration does not match production. Run build:production before deploying.",
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  loadProductionEnvironment();
  const config = productionConfig(readSourceConfig());
  fs.writeFileSync(sourceConfigPath, JSON.stringify(config, null, 2) + "\n");
  console.log("Production Worker configuration prepared.");
}

/** Translate app-scoped deployment credentials to Wrangler's required names. */
export function wranglerEnvironment(environment = process.env) {
  for (const name of [
    "DASHBOARD_CLOUDFLARE_ACCOUNT_ID",
    "DASHBOARD_CLOUDFLARE_API_TOKEN",
  ]) {
    if (!environment[name])
      throw new Error(`Missing deployment environment variable: ${name}`);
  }
  return {
    ...environment,
    CLOUDFLARE_ACCOUNT_ID: environment.DASHBOARD_CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: environment.DASHBOARD_CLOUDFLARE_API_TOKEN,
  };
}

export function runtimeSecrets(environment = process.env) {
  wranglerEnvironment(environment);
  const secrets = {};
  for (const name of ["JWT_SECRET", "PROXY_API_TOKEN"]) {
    const inputName = `DASHBOARD_${name}`;
    if (!environment[inputName])
      throw new Error(`Missing deployment environment variable: ${inputName}`);
    if (Buffer.byteLength(environment[inputName]) < 32)
      throw new Error(`${inputName} must contain at least 32 bytes.`);
    secrets[name] = environment[inputName];
  }
  if (environment.DASHBOARD_PUBLISH_API_TOKEN) {
    secrets.CLOUDFLARE_API_TOKEN = environment.DASHBOARD_PUBLISH_API_TOKEN;
    secrets.CLOUDFLARE_ACCOUNT_ID =
      environment.DASHBOARD_PUBLISH_ACCOUNT_ID ||
      environment.DASHBOARD_CLOUDFLARE_ACCOUNT_ID;
  }
  return secrets;
}
