import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envFile = path.join(toolRoot, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const args = process.argv.slice(2);
const hasTokenArgument =
  args.includes("--token") || args.some((arg) => arg.startsWith("--token="));
const token = process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN;
if (!token && !hasTokenArgument) {
  console.error(
    "Set CLOUDFLARE_TUNNEL_TOKEN in tools/api-proxy/.env or pass --token.",
  );
  process.exit(1);
}

const child = spawn(
  "cloudflared",
  [
    "tunnel",
    "run",
    ...(!hasTokenArgument && token ? ["--token", token] : []),
    ...args,
  ],
  {
    stdio: "inherit",
  },
);
child.on("error", (error) => {
  console.error(`[tunnel] ${error.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
