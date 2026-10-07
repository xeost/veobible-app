import { spawnSync } from "node:child_process";
import {
  dashboardRoot,
  sourceConfigPath,
  readSourceConfig,
  productionConfig,
  loadProductionEnvironment,
} from "./configure-production.mjs";

loadProductionEnvironment();
const source = readSourceConfig();
const expected = productionConfig(source);
if (
  JSON.stringify(source.env.production) !==
  JSON.stringify(expected.env.production)
)
  throw new Error(
    "Run build:production before applying production migrations.",
  );
for (const name of ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]) {
  if (!process.env[name])
    throw new Error(`Missing deployment environment variable: ${name}`);
}
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--config",
    sourceConfigPath,
    "--env",
    "production",
  ],
  { cwd: dashboardRoot, stdio: "inherit", env: process.env },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
