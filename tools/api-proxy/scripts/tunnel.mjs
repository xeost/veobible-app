import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readProxyTokens } from "../src/tokens.mjs";

const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envFile = path.join(toolRoot, ".env");
if (process.argv.length > 2) {
  console.error("Configure the tunnel only in tools/api-proxy/.env; command-line options are not supported.");
  process.exit(1);
}
const { tunnelToken } = readProxyTokens(envFile);
if (!tunnelToken) {
  console.error("Set CLOUDFLARE_TUNNEL_TOKEN in tools/api-proxy/.env.");
  process.exit(1);
}

const child = spawn(
  "cloudflared",
  ["tunnel", "run", "--token", tunnelToken],
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
