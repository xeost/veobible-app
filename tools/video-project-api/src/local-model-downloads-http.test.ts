import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import type { LocalModels } from "./local-models-contract.js";

test(
  "model downloads run in background through hf, reuse the shared cache and enable only verified weights",
  { timeout: 30000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "model-download-http-"),
    );
    let child: ReturnType<typeof spawn> | undefined;
    try {
      const socket = net.createServer();
      socket.listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = (socket.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => socket.close(() => resolve()));
      const bin = path.join(root, "bin");
      await fs.mkdir(bin);
      // An isolated stand-in exercises the actual subprocess arguments and cache
      // verification without accessing the network or downloading real weights.
      await fs.writeFile(
        path.join(bin, "hf"),
        `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(process.env.WORKING_DIR, "hf-commands.jsonl"), JSON.stringify(args) + "\\n");
if (args.includes("--local-dir") || args.includes("--cache-dir")) process.exit(2);
const timer = setInterval(() => {
  if (!fs.existsSync(path.join(process.env.WORKING_DIR, "release-download"))) return;
  clearInterval(timer);
  if (args[1].includes("1.7B")) { console.error("simulated download failure"); process.exit(1); }
  const folder = path.join(process.env.HF_HUB_CACHE, "models--" + args[1].replaceAll("/", "--"));
  const revision = "a".repeat(40);
  const snapshot = path.join(folder, "snapshots", revision);
  for (const file of ["config.json", "model.safetensors", "tokenizer_config.json", "preprocessor_config.json", "generation_config.json", "vocab.json", "merges.txt", "speech_tokenizer/config.json", "speech_tokenizer/preprocessor_config.json", "speech_tokenizer/model.safetensors"]) {
    const target = path.join(snapshot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "test data");
  }
  fs.mkdirSync(path.join(folder, "refs"), { recursive: true });
  fs.writeFileSync(path.join(folder, "refs", "main"), revision);
}, 20);
`,
      );
      await fs.chmod(path.join(bin, "hf"), 0o755);
      const repository = "Qwen/Qwen3-TTS-12Hz-0.6B-Base";
      const variant = "qwen3-base-0.6b";
      await fs.writeFile(
        path.join(root, "disabled-models.json"),
        JSON.stringify([
          `${repository}:${variant}`,
          "Qwen/Qwen3-TTS-12Hz-1.7B-Base:qwen3-base-1.7b",
        ]),
      );
      const token = "model-download-test-token-1234567890";
      child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          PORT: String(port),
          API_TOKEN: token,
          API_PROXY_CHILD: "1",
          WORKING_DIR: root,
          HF_HUB_CACHE: path.join(root, "hub"),
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          VIDEO_QWEN_TTS_PYTHON: path.join(root, "missing-python"),
          VIDEO_COSYVOICE_TTS_PYTHON: path.join(root, "missing-python"),
          VIDEO_SHORT_TTS_PROVIDER: "elevenlabs",
          VIDEO_LONG_TTS_PROVIDER: "elevenlabs",
          VIDEO_ALIGNER_PYTHON: path.join(root, "missing-python"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      await new Promise<void>((resolve, reject) => {
        child!.stdout!.on("data", (chunk) => {
          if (String(chunk).includes("Video API:")) resolve();
        });
        child!.once("error", reject);
        child!.once("exit", (code) => reject(new Error(`API exited: ${code}`)));
      });
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const base = `http://127.0.0.1:${port}/v1/local-models`;
      const inventory = async () => {
        const response = await fetch(`${base}?refresh=1`, { headers });
        assert.equal(response.status, 200);
        return (await response.json()) as LocalModels;
      };
      const items = (await inventory()).models;
      const model = items.find((item) => item.variant === variant)!;
      const other = items.find((item) => item.variant === "qwen3-base-1.7b")!;
      const url = `${base}/${model.id}/download`;
      const request = {
        method: "POST",
        headers,
        body: JSON.stringify({ repository, variant }),
      };
      assert.equal((await fetch(url, { method: "POST" })).status, 401);
      assert.equal(
        (
          await fetch(url, {
            ...request,
            body: JSON.stringify({ repository: "untrusted/repo", variant }),
          })
        ).status,
        409,
      );
      assert.equal((await fetch(url, request)).status, 202);
      assert.equal((await fetch(url, request)).status, 202);
      const during = (await inventory()).models.find(
        (item) => item.variant === variant,
      )!;
      assert.equal(during.enabled, false);
      assert.equal(during.download?.status, "downloading");
      assert.equal(
        (await fetch(`${base}/${model.id}`, { ...request, method: "DELETE" }))
          .status,
        409,
      );
      const otherRequest = {
        method: "POST",
        headers,
        body: JSON.stringify({
          repository: other.repository,
          variant: other.variant,
        }),
      };
      assert.equal(
        (await fetch(`${base}/${other.id}/download`, otherRequest)).status,
        409,
      );
      await fs.writeFile(path.join(root, "release-download"), "ready");
      let finished: typeof model | undefined;
      for (let attempts = 0; attempts < 30; attempts++) {
        finished = (await inventory()).models.find(
          (item) => item.variant === variant,
        );
        if (finished?.download?.status === "completed") break;
        await delay(100);
      }
      assert.equal(finished?.download?.status, "completed");
      assert.equal(finished?.status, "downloaded");
      assert.equal(finished?.enabled, true);
      const commands = (
        await fs.readFile(path.join(root, "hf-commands.jsonl"), "utf8")
      )
        .trim()
        .split("\n");
      assert.equal(commands.length, 1);
      assert.equal(JSON.parse(commands[0])[1], repository);
      assert.equal(
        (await fetch(`${base}/${other.id}/download`, otherRequest)).status,
        202,
      );
      let failed: typeof model | undefined;
      for (let attempts = 0; attempts < 30; attempts++) {
        failed = (await inventory()).models.find(
          (item) => item.variant === other.variant,
        );
        if (failed?.download?.status === "failed") break;
        await delay(100);
      }
      assert.equal(failed?.download?.status, "failed");
      assert.equal(failed?.enabled, false);
      assert.ok(
        !JSON.stringify(failed?.download).includes(
          "simulated download failure",
        ),
      );
    } finally {
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
