import fs from "node:fs";
import { parseEnv } from "node:util";

export function readProxyTokens(envFile) {
  const config = fs.existsSync(envFile)
    ? parseEnv(fs.readFileSync(envFile, "utf8"))
    : {};
  return {
    apiToken: config.API_TOKEN,
    tunnelToken: config.CLOUDFLARE_TUNNEL_TOKEN,
  };
}

export function serviceEnvironment(environment, apiToken, port) {
  const child = { ...environment };
  delete child.CLOUDFLARE_TUNNEL_TOKEN;
  delete child.TUNNEL_TOKEN;
  delete child.TUNNEL_TOKEN_FILE;
  return {
    ...child,
    API_TOKEN: apiToken,
    PORT: String(port),
    API_PROXY_CHILD: "1",
  };
}
