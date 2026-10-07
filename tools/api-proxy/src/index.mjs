import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProxy } from "./proxy.mjs";

const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(toolRoot, "../..");
const envFile = path.join(toolRoot, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

function port(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error(`${name} must be a valid TCP port`);
  return value;
}
const proxyPort = port("PROXY_PORT", 8420);
const videoPort = port("VIDEO_PORT", 8422);
if (proxyPort === videoPort)
  throw new Error("Proxy and API ports must be distinct");

const services = {
  video: {
    directory: "video-project-api",
    entry: "src/server.ts",
    port: videoPort,
  },
};
const children = new Map();
let stopping = false;

function prefixOutput(stream, label, destination) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n|\r/);
    pending = lines.pop() || "";
    for (const line of lines)
      if (line) destination.write(`[${label}] ${line}\n`);
  });
  stream.on("end", () => {
    if (pending) destination.write(`[${label}] ${pending}\n`);
  });
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (server.listening) server.close();
  for (const child of children.values()) child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    for (const child of children.values()) child.kill("SIGKILL");
    process.exit(exitCode);
  }, 5_000);
  timeout.unref();
  if (!children.size) process.exit(exitCode);
}

if (!process.env.VIDEO_API_TOKEN)
  throw new Error("Set VIDEO_API_TOKEN in tools/api-proxy/.env");

const server = createProxy({
  videoPort,
  token: process.env.VIDEO_API_TOKEN,
  isRunning: (name) => children.has(name),
});
server.on("error", (error) => {
  console.error(`[proxy] ${error.message}`);
  stop(1);
});
server.listen(proxyPort, "127.0.0.1", () => {
  console.log(`[proxy] Listening on http://127.0.0.1:${proxyPort}`);
  for (const [name, service] of Object.entries(services)) {
    const cwd = path.join(workspaceRoot, "tools", service.directory);
    const child = spawn(process.execPath, ["--import", "tsx", service.entry], {
      cwd,
      env: { ...process.env, PORT: String(service.port), API_PROXY_CHILD: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.set(name, child);
    prefixOutput(child.stdout, name, process.stdout);
    prefixOutput(child.stderr, name, process.stderr);
    child.on("error", (error) => {
      console.error(`[${name}] ${error.message}`);
      stop(1);
    });
    child.on("exit", (code, signal) => {
      children.delete(name);
      if (!stopping) {
        console.error(
          `[${name}] API exited (${signal || code}); stopping the proxy`,
        );
        stop(1);
      } else if (!children.size) process.exit(process.exitCode || 0);
    });
    console.log(`[proxy] Starting ${name} API on 127.0.0.1:${service.port}`);
  }
});

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
