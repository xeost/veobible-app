import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readProxyTokens, serviceEnvironment } from "./tokens.mjs";

const execute = promisify(execFile);

test("tokens come only from the proxy file, including when it is absent", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "proxy-tokens-"));
  try {
    const envFile = path.join(directory, ".env");
    await fs.writeFile(envFile, 'API_TOKEN="file-api-token"\nCLOUDFLARE_TUNNEL_TOKEN=file-tunnel-token\n');
    const script = `import {readProxyTokens} from ${JSON.stringify(new URL("./tokens.mjs", import.meta.url).href)};
console.log(JSON.stringify(readProxyTokens(process.argv[1])));`;
    const env = { ...process.env, API_TOKEN: "environment-api-token", CLOUDFLARE_TUNNEL_TOKEN: "environment-tunnel-token", TUNNEL_TOKEN: "legacy-token" };
    const { stdout } = await execute(process.execPath, ["--input-type=module", "-e", script, envFile], { env });
    assert.deepEqual(JSON.parse(stdout), { apiToken: "file-api-token", tunnelToken: "file-tunnel-token" });
    await fs.unlink(envFile);
    const missing = await execute(process.execPath, ["--input-type=module", "-e", script, envFile], { env });
    assert.deepEqual(JSON.parse(missing.stdout), {});
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("child receives the configured API token without tunnel credentials", () => {
  const parent = { API_TOKEN: "old-token", CLOUDFLARE_TUNNEL_TOKEN: "private", TUNNEL_TOKEN: "legacy", TUNNEL_TOKEN_FILE: "private-file", WORKING_DIR: "/work", PATH: "/bin" };
  assert.deepEqual(serviceEnvironment(parent, "proxy-token", 8422), {
    API_TOKEN: "proxy-token", WORKING_DIR: "/work", PATH: "/bin", PORT: "8422", API_PROXY_CHILD: "1",
  });
  assert.equal(parent.CLOUDFLARE_TUNNEL_TOKEN, "private");
});

test("tunnel rejects credential arguments before launching cloudflared", async () => {
  await assert.rejects(
    execute(process.execPath, [new URL("../scripts/tunnel.mjs", import.meta.url).pathname, "--token=override"]),
    (error) => error.code === 1 && error.stderr.includes("command-line options are not supported"),
  );
});
