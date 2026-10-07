import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";

test(
  "HTTP discovery, playback and final render state share production outputs while development remains isolated",
  { timeout: 30000 },
  async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "existing-project-http-"),
    );
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const port = (socket.address() as net.AddressInfo).port;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    let child: ReturnType<typeof spawn> | undefined;
    try {
      const output = path.join(directory, "outputs/rv1909/john-3-16");
      await fs.mkdir(path.join(output, "_internal"), { recursive: true });
      await fs.writeFile(
        path.join(output, "_internal/0-metadata.txt"),
        "Idioma: es\nReferencia: Juan 3:16\nLibro: Juan (john)\nInicio: 3:16\nFin: 3:16\n",
      );
      await fs.writeFile(path.join(output, "_internal/1-intro.wav"), "voice");
      await fs.writeFile(path.join(output, "short.mp4"), "video");
      await fs.writeFile(path.join(output, "youtube.txt"), "Caption");
      const token = "existing-project-test-token-1234567890";
      child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          PORT: String(port),
          PROXY_API_TOKEN: token,
          SHORTS_WORKING_DIR: directory,
          LONGS_WORKING_DIR: path.join(directory, "long"),
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
      const headers = { Authorization: `Bearer ${token}` };
      const base = `http://127.0.0.1:${port}`;
      const found = await fetch(`${base}/v1/projects/existing?kind=short`, {
        headers,
      });
      assert.equal(found.status, 200);
      assert.equal((await found.json()).projects[0].slug, "john-3-16");
      const query =
        "kind=short&version=rv1909&passage=john-3-16&outputEnvironment=production";
      const state = await fetch(`${base}/v1/projects/1/state?${query}`, {
        headers,
      });
      const data = await state.json();
      assert.equal(data.status, "ready");
      assert.equal(data.progress, 100);
      const queue = await fetch(`${base}/v1/queue`, { headers });
      assert.deepEqual((await queue.json()).summary, {
        progress: 0,
        completed: 0,
        total: 0,
      });
      assert.equal(data.result.descriptions["youtube.txt"], "Caption");
      const voices = await fetch(`${base}/v1/projects/1/voices?${query}`, {
        headers,
      });
      const voiceData = (await voices.json()).voices;
      assert.equal(voiceData.intro.available, true);
      assert.equal(voiceData.intro.progress, 100);
      assert.equal(voiceData.outro.progress, 0);
      const media = await fetch(`${base}/v1/projects/1/media/video?${query}`, {
        headers,
      });
      assert.equal(media.status, 200);
      assert.equal(await media.text(), "video");
      const development = await fetch(
        `${base}/v1/projects/1/state?${query.replace("production", "development")}`,
        { headers },
      );
      const developmentData = await development.json();
      assert.equal(developmentData.status, "draft");
      assert.equal(developmentData.progress, 0);
      const devOutput = path.join(directory, "outputs-dev/rv1909/john-3-16");
      await fs.mkdir(path.join(devOutput, "_internal"), { recursive: true });
      await fs.copyFile(
        path.join(output, "_internal/0-metadata.txt"),
        path.join(devOutput, "_internal/0-metadata.txt"),
      );
      await fs.writeFile(
        path.join(devOutput, "_internal/2-passage-audio-settings.json"),
        JSON.stringify({ volumeMultiplier: 3 }),
      );
      await fs.writeFile(
        path.join(directory, "outputs-dev/status.json"),
        JSON.stringify({
          "es/rv1909/john-3-16": {
            locale: "es",
            version: "rv1909",
            usedAt: "2026-01-01",
            output: devOutput,
          },
        }),
      );
      const devFound = await fetch(
        `${base}/v1/projects/existing?kind=short&outputEnvironment=development`,
        { headers },
      );
      const devData = await devFound.json();
      assert.equal(devData.projects.length, 1);
      assert.equal(devData.projects[0].settings.volumeMultiplier, 3);
      assert.equal(devData.projects[0].published, true);
      const productionFound = await fetch(
        `${base}/v1/projects/existing?kind=short&outputEnvironment=production`,
        { headers },
      );
      assert.equal((await productionFound.json()).projects[0].published, false);
      const empty = await fetch(`${base}/v1/projects/existing?kind=long`, {
        headers,
      });
      assert.deepEqual((await empty.json()).projects, []);
    } finally {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await once(child, "close");
      }
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
