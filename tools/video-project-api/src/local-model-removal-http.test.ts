import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";

test(
  "model removal authenticates, checks identity, deletes weights and keeps models unavailable until weights are downloaded",
  { timeout: 30000 },
  async () => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "model-removal-http-"),
    );
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = (socket.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    let child: ReturnType<typeof spawn> | undefined;
    try {
      const repository = "Qwen/Qwen3-TTS-12Hz-0.6B-Base";
      const variant = "qwen3-base-0.6b";
      const cache = path.join(root, "hub");
      const folder = path.join(cache, "models--Qwen--Qwen3-TTS-12Hz-0.6B-Base");
      const revision = "a".repeat(40);
      const snapshot = path.join(folder, "snapshots", revision);
      await fs.mkdir(snapshot, { recursive: true });
      await fs.mkdir(path.join(folder, "refs"));
      await fs.writeFile(path.join(folder, "refs/main"), revision);
      await fs.writeFile(
        path.join(snapshot, "model.safetensors"),
        "test weights",
      );
      const bin = path.join(root, "bin");
      await fs.mkdir(bin);
      await fs.writeFile(
        path.join(bin, "hf"),
        `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
if (args[0] !== "cache" || args[1] !== "rm" || args[3] !== "--yes") process.exit(2);
fs.rmSync(path.join(process.env.HF_HUB_CACHE, "models--" + args[2].slice(6).replaceAll("/", "--")), { recursive: true, force: true });
`,
      );
      await fs.chmod(path.join(bin, "hf"), 0o755);
      const token = "local-model-removal-test-token-1234567890";
      child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          PORT: String(port),
          API_TOKEN: token,
          API_PROXY_CHILD: "1",
          WORKING_DIR: root,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
          HF_HUB_CACHE: cache,
          VIDEO_QWEN_TTS_PYTHON: "python3",
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
        return (await response.json()).models as Array<{
          id: string;
          variant: string;
          enabled: boolean;
        }>;
      };
      const model = (await inventory()).find(
        (model) => model.variant === variant,
      )!;
      assert.equal(model.enabled, false);
      const url = `${base}/${model.id}`;
      const body = JSON.stringify({ repository, variant });
      assert.equal((await fetch(url, { method: "DELETE", body })).status, 401);
      assert.equal(
        (
          await fetch(url, {
            method: "DELETE",
            headers,
            body: JSON.stringify({ repository, variant: "other" }),
          })
        ).status,
        409,
      );
      assert.equal(
        await fs.readFile(path.join(snapshot, "model.safetensors"), "utf8"),
        "test weights",
      );
      assert.equal(
        (await fetch(url, { method: "DELETE", headers, body })).status,
        200,
      );
      await assert.rejects(fs.stat(path.join(snapshot, "model.safetensors")), {
        code: "ENOENT",
      });
      await assert.rejects(fs.stat(folder), { code: "ENOENT" });
      assert.equal(
        (await inventory()).find((item) => item.variant === variant)!.enabled,
        false,
      );
      assert.deepEqual(
        JSON.parse(
          await fs.readFile(path.join(root, "disabled-models.json"), "utf8"),
        ),
        [`${repository}:${variant}`],
      );
      assert.equal(
        (await fetch(url, { method: "PATCH", headers, body })).status,
        409,
      );
      assert.equal(
        (await inventory()).find((item) => item.variant === variant)!.enabled,
        false,
      );
      const cosy = (await inventory()).find(
        (item) => item.variant === "cosyvoice3-base-0.5b",
      )!;
      assert.equal(
        (
          await fetch(`${base}/${cosy.id}`, {
            method: "DELETE",
            headers,
            body: JSON.stringify({
              repository: "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
              variant: cosy.variant,
            }),
          })
        ).status,
        200,
      );
      assert.equal(
        (await inventory()).find((item) => item.variant === cosy.variant)!
          .enabled,
        false,
      );

      const disabled = JSON.parse(
        await fs.readFile(path.join(root, "disabled-models.json"), "utf8"),
      );
      assert.ok(
        disabled.includes(
          "FunAudioLLM/Fun-CosyVoice3-0.5B-2512:cosyvoice3-rl-0.5b",
        ),
      );
      await assert.rejects(fs.stat(path.join(snapshot, "model.safetensors")), {
        code: "ENOENT",
      });
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
