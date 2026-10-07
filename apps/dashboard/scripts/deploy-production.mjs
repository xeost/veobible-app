import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  dashboardRoot,
  readSourceConfig,
  buildConfigPath,
  productionConfig,
  assertProductionBuild,
  loadProductionEnvironment,
  runtimeSecrets,
  wranglerEnvironment,
} from "./configure-production.mjs";

loadProductionEnvironment();
const args = process.argv.slice(2);
if (
  args.length > 1 ||
  args.some((arg) => !["--dry-run", "--check"].includes(arg))
)
  throw new Error("Only --dry-run and --check are supported.");
const source = productionConfig(readSourceConfig());
assertProductionBuild(
  JSON.parse(fs.readFileSync(buildConfigPath, "utf8")),
  source,
);
const dryRun = args.includes("--dry-run");
const secrets = dryRun ? {} : runtimeSecrets();
if (args.includes("--check")) {
  console.log("Production configuration and required secrets validated.");
} else {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "veobible-dashboard-deploy-"),
  );
  try {
    const secretsFile = path.join(directory, "secrets.json");
    const command = ["exec", "wrangler", "deploy", "--config", buildConfigPath];
    if (dryRun) command.push("--dry-run");
    else {
      fs.writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
      command.push("--secrets-file", secretsFile);
    }
    const result = spawnSync("pnpm", command, {
      cwd: dashboardRoot,
      stdio: "inherit",
      env: wranglerEnvironment(),
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
