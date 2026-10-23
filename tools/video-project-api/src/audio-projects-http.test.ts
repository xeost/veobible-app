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
await new Promise(resolve=>setTimeout(resolve,800));
await fs.appendFile(process.env.AUDIO_TEST_LOG,await fs.readFile(arg('--scripts'),'utf8')+'\\n');
await fs.writeFile(path.join(arg('--output-dir'),'intro.txt'), JSON.parse(await fs.readFile(arg('--scripts'),'utf8')).intro);
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
            AUDIO_TEST_OVERRIDE: "Rrosa corrre rrápido.",
            VIDEO_ALIGNER_PYTHON: process.execPath,
            VIDEO_ALIGNER_SCRIPT: path.join(root, "align.mjs"),
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
      await fs.writeFile(
        path.join(root, "align.mjs"),
        `import fs from 'node:fs/promises';
const arg = key => process.argv[process.argv.indexOf(key) + 1];
const request = JSON.parse(await fs.readFile(arg('--request'), 'utf8'));
if (request.language !== 'es' || request.detectHeadings !== false) throw new Error('Invalid alignment request');
const chapter = request.chapters[0];
const text = await fs.readFile(chapter.audio.slice(0, -4) + '.txt', 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return process.env.AUDIO_TEST_OVERRIDE;
});
if (chapter.segments.length !== 1 || chapter.segments[0].text.trim() !== text.trim()) throw new Error('Wrong verse transcript');
await fs.appendFile(process.env.AUDIO_TEST_LOG + '.alignment', chapter.audio + '\\n');
await fs.writeFile(arg('--output'), JSON.stringify({model: 'fixture', chapters: [{index: 0, segments: chapter.segments.map(segment => ({id: segment.id, words: [{text: segment.text, start: 0.06, end: 0.12}]}))}]}));`,
      );
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
      // Listing works without callback access; generation needs an allowed origin.
      const denied = await fetch(`${project}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...snapshot(),
          callback: {
            url: `https://unconfigured-dashboard.example/api/audio-project-events/1/${jobId}`,
            token: callbackToken,
          },
          input: { chapter: 1, verse: 1, voiceModel: "multilingual-v3" },
        }),
      });
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).error, "Origin not allowed");
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
      const activeQueue = await (
        await fetch(`${base}/v1/queue?outputEnvironment=production`, {
          headers,
        })
      ).json();
      const activeAudio = activeQueue.items.find(
        (item: any) => item.kind === "audio",
      );
      assert.ok(activeAudio, diagnostics);
      assert.equal(activeAudio.projectId, 1);
      assert.equal(activeAudio.chapter, 1);
      assert.equal(activeAudio.verse, 1);
      assert.equal(activeAudio.groupId, jobId);
      assert.ok(["queued", "running"].includes(activeAudio.status));
      const reloaded = await (
        await fetch(project, {
          method: "POST",
          headers,
          body: JSON.stringify(snapshot()),
        })
      ).json();
      assert.ok(["queued", "running"].includes(reloaded.status));
      assert.equal(
        (
          await (
            await fetch(`${base}/v1/queue?outputEnvironment=development`, {
              headers,
            })
          ).json()
        ).items.length,
        0,
      );
      const appendBody = () =>
        JSON.stringify({
          ...snapshot(),
          append: true,
          input: { chapter: 1, verse: 2, voiceModel: "multilingual-v3" },
        });
      const appended = await fetch(`${project}/generate`, {
        method: "POST",
        headers,
        body: appendBody(),
      });
      assert.equal(appended.status, 202, await appended.text());
      const duplicate = await fetch(`${project}/generate`, {
        method: "POST",
        headers,
        body: appendBody(),
      });
      assert.equal(duplicate.status, 409);
      const multiple = await (
        await fetch(`${base}/v1/queue?outputEnvironment=production`, {
          headers,
        })
      ).json();
      assert.equal(
        multiple.items.filter((item: any) => item.kind === "audio").length,
        2,
      );
      assert.equal(new Set(multiple.items.map((item: any) => item.id)).size, 2);
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
      assert.ok(state.recordings["1:2"]);
      for (const ref of ["1:1", "1:2"]) {
        assert.ok(
          Math.abs(state.settings.trims[ref].startSeconds - 0.03) < 1e-6,
        );
        assert.ok(Math.abs(state.settings.trims[ref].endSeconds - 0.17) < 1e-6);
      }
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
      const analyze = await fetch(`${project}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...snapshot(),
          callback: {
            url: `${callbackOrigin}/api/audio-project-events/1/${jobId}`,
            token: callbackToken,
          },
          input: { chapter: 1, alignOnly: true },
        }),
      });
      assert.equal(analyze.status, 202, await analyze.text());
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
      assert.deepEqual(state.recordings, persisted.recordings);
      assert.deepEqual(state.settings.trims, persisted.settings.trims);
      assert.equal(
        await fs.readFile(path.join(root, "calls.log"), "utf8"),
        log,
      );
      assert.equal(
        (await fs.readFile(path.join(root, "calls.log.alignment"), "utf8"))
          .trim()
          .split("\n").length,
        4,
      );
      const analysisQueue = await (
        await fetch(`${base}/v1/queue?outputEnvironment=production`, {
          headers,
        })
      ).json();
      assert.equal(
        analysisQueue.items.filter(
          (item: any) => item.kind === "audio" && item.type === "alignment",
        ).length,
        2,
      );
      const previousRecordings = structuredClone(state.recordings);
      const adapted = "Rosa corre rápido.";
      const pronunciation = await fetch(`${project}/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...snapshot(),
          callback: {
            url: `${callbackOrigin}/api/audio-project-events/1/${jobId}`,
            token: callbackToken,
          },
          input: {
            chapter: 1,
            verse: 1,
            regenerate: true,
            textOverride: adapted,
            voiceTextAdaptations: { reinforceSpanishRs: true },
          },
        }),
      });
      assert.equal(pronunciation.status, 202, await pronunciation.text());
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
      assert.notEqual(
        state.recordings["1:1"].revision,
        previousRecordings["1:1"].revision,
      );
      assert.deepEqual(state.recordings["1:2"], previousRecordings["1:2"]);
      assert.equal(JSON.stringify(state).includes(adapted), false);
      assert.ok(
        (await fs.readFile(path.join(root, "calls.log"), "utf8")).includes(
          "Rrosa corrre rrápido.",
        ),
      );
      assert.deepEqual(
        await fs.readdir(
          path.dirname(
            path.join(
              root,
              "material/audios/rv1909-v2_internal",
              state.recordings["1:1"].file,
            ),
          ),
        ),
        ["intro.wav"],
      );
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
