import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import type { AudioProject } from "./audio-project-schema.js";
import { once } from "node:events";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./engines/long/config.js";

test(
  "audio worker reports durable snapshots and rehydrates database state after restart",
  { timeout: 60000 },
  async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "audio-http-"));
    const socket = net.createServer();
    let child: ReturnType<typeof spawn> | undefined;
    let diagnostics = "";
    let durable!: AudioProject,
      sequence = 0;
    const callbackToken = "audio-project-callback-token-123456789012345";
    const callbackServer = http.createServer(async (req, res) => {
      if (req.headers.authorization !== `Bearer ${callbackToken}`) {
        res.writeHead(401);
        res.end();
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const event = JSON.parse(Buffer.concat(chunks).toString());
      if (event.sequence > sequence) {
        durable = event.project;
        sequence = event.sequence;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("{}");
    });
    try {
      socket.listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = (socket.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => socket.close(() => resolve()));
      callbackServer.listen(0, "127.0.0.1");
      await once(callbackServer, "listening");
      const callbackOrigin = `http://127.0.0.1:${(callbackServer.address() as net.AddressInfo).port}`;
      const token = "audio-project-test-token-123456789012345";
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const base = `http://127.0.0.1:${port}`;
      const voice = path.join(root, "material/voices");
      await fs.mkdir(voice, { recursive: true });
      await promisify(execFile)(config.ffmpegBin, [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=0.2",
        path.join(voice, "es-1.mp3"),
      ]);
      const worker = path.join(root, "voice.mjs");
      await fs.writeFile(
        worker,
        `import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const arg=k=>process.argv[process.argv.indexOf(k)+1];
await fs.appendFile(process.env.AUDIO_TEST_LOG,await fs.readFile(arg('--scripts'),'utf8')+'\\n');
await promisify(execFile)(process.env.AUDIO_TEST_FFMPEG,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=0.2',path.join(arg('--output-dir'),'intro.wav')]);`,
      );
      const start = async () => {
        child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
          env: {
            ...process.env,
            API_PROXY_CHILD: "1",
            API_TOKEN: token,
            PORT: String(port),
            DASHBOARD_ORIGINS: callbackOrigin,
            WORKING_DIR: root,
            VIDEO_TTS_SCRIPT: worker,
            VIDEO_LONG_TTS_PYTHON: process.execPath,
            AUDIO_TEST_LOG: path.join(root, "calls.log"),
            AUDIO_TEST_FFMPEG: config.ffmpegBin,
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let errors = "";
        child.stderr!.on("data", (data) => {
          errors += data;
          diagnostics += data;
        });
        await new Promise<void>((resolve, reject) => {
          child!.stdout!.on("data", (data) => {
            if (String(data).includes("Video API:")) resolve();
          });
          child!.once("error", reject);
          child!.once("exit", () => reject(new Error(errors)));
        });
      };
      const stop = async () => {
        const exited = once(child!, "exit");
        child!.kill("SIGTERM");
        await exited;
        child = undefined;
      };
      await start();
      assert.equal((await fetch(`${base}/v1/audio-projects`)).status, 401);
      const version = {
        id: 1,
        code: "rv1909",
        locale: "es",
        label: "Reina Valera 1909",
      };
      const options = await fetch(`${base}/v1/audio-projects/options`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          versions: [version],
          outputEnvironment: "production",
        }),
      });
      assert.equal((await options.json()).versions[0].edition, "rv1909-v2");
      const created = await fetch(`${base}/v1/audio-projects`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          version,
          edition: "rv1909-v2",
          outputEnvironment: "production",
        }),
      });
      assert.equal(created.status, 201);
      // One shared worker serves both environments, each with its own numbering.
      const devCreate = await fetch(`${base}/v1/audio-projects`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          version,
          edition: "rv1909-v2",
          outputEnvironment: "development",
        }),
      });
      assert.equal(devCreate.status, 201);
      const dev = await devCreate.json();
      const mismatched = await fetch(
        `${base}/v1/audio-projects/rv1909-v2/jude`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            project: dev.projects.find((p: AudioProject) => p.book === "jude"),
            outputEnvironment: "production",
          }),
        },
      );
      assert.equal(mismatched.status, 400);
      const missingEnvironment = await fetch(
        `${base}/v1/audio-projects/options`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ versions: [version] }),
        },
      );
      assert.equal(missingEnvironment.status, 400);
      assert.ok(
        (
          await fs.stat(
            path.join(root, "material/audios/dev/rv1909-v2_internal"),
          )
        ).isDirectory(),
      );
      const creation = await created.json();
      assert.equal(creation.projects.length, 66);
      durable = creation.projects.find((p: AudioProject) => p.book === "jude");
      const jobId = crypto.randomUUID();
      const snapshot = () => ({
        project: durable,
        jobId,
        sequence,
        outputEnvironment: "production",
      });
      const project = `${base}/v1/audio-projects/rv1909-v2/jude`;
      const generated = await fetch(`${project}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...snapshot(),
          callback: {
            url: `${callbackOrigin}/api/audio-project-events/1/${jobId}`,
            token: callbackToken,
          },
          input: { chapter: 1, verse: 1, voiceModel: "multilingual-v3" },
        }),
      });
      assert.equal(
        generated.status,
        202,
        diagnostics + (await generated.text()),
      );
      let state;
      for (let attempt = 0; attempt < 150; attempt++) {
        state = await (
          await fetch(project, {
            method: "POST",
            headers,
            body: JSON.stringify(snapshot()),
          })
        ).json();
        if (!["queued", "running"].includes(state.status)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(state.status, "draft", diagnostics);
      assert.ok(state.recordings["1:1"]);
      const media = await fetch(`${project}/media?chapter=1&verse=1`, {
        method: "POST",
        body: JSON.stringify(snapshot()),
        headers: { ...headers, Range: "bytes=0-3" },
      });
      assert.equal(media.status, 206);
      assert.equal(await media.text(), "RIFF");
      assert.equal(media.headers.get("content-length"), "4");
      assert.equal(
        (
          await fetch(`${project}/media?chapter=1&verse=1`, {
            method: "POST",
            body: JSON.stringify(snapshot()),
            headers: { ...headers, Range: "bytes=999999999-" },
          })
        ).status,
        416,
      );
      const invalid = await fetch(`${base}/v1/audio-projects/rv1909/jude`, {
        headers,
        method: "POST",
        body: JSON.stringify(snapshot()),
      });
      assert.equal(invalid.status, 400, await invalid.text());
      await stop();
      await start();
      const persisted = await (
        await fetch(project, {
          method: "POST",
          headers,
          body: JSON.stringify(snapshot()),
        })
      ).json();
      assert.equal(
        persisted.recordings["1:1"].revision,
        state.recordings["1:1"].revision,
      );
      assert.equal(
        await fs
          .stat(path.join(root, "material/audios/rv1909-v2_internal/jude.json"))
          .then(
            () => true,
            () => false,
          ),
        false,
      );
      assert.equal(
        durable.recordings["1:1"].revision,
        state.recordings["1:1"].revision,
      );
      const log = await fs.readFile(path.join(root, "calls.log"), "utf8");
      assert.ok(log.includes("Judas"));
      await stop();
    } finally {
      if (child) {
        const exited = once(child, "exit");
        child.kill("SIGTERM");
        await exited;
      }
      if (socket.listening) socket.close();
      await new Promise<void>((resolve) =>
        callbackServer.close(() => resolve()),
      );
      await fs.rm(root, { recursive: true, force: true });
    }
  },
);
