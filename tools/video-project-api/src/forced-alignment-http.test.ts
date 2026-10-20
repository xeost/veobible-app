import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
test(
  "alignment HTTP jobs share the queue, isolate environments and retain completed results after restart",
  { timeout: 30000 },
  async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "veobible-align-http-"),
    );
    const root = fileURLToPath(new URL("..", import.meta.url));
    const isolated = path.join(directory, "tools/video-project-api");
    let child: ReturnType<typeof spawn> | undefined;
    try {
      await fs.mkdir(isolated, { recursive: true });
      await fs.cp(path.join(root, "src"), path.join(isolated, "src"), {
        recursive: true,
      });
      await fs.copyFile(
        path.join(root, "package.json"),
        path.join(isolated, "package.json"),
      );
      await fs.symlink(
        path.join(root, "node_modules"),
        path.join(isolated, "node_modules"),
      );
      const bible = path.join(
        directory,
        "apps/frontend/public/bible-data/en/kjv",
      );
      await fs.mkdir(path.join(bible, "psalms"), { recursive: true });
      await fs.writeFile(
        path.join(bible, "index.json"),
        JSON.stringify({
          metadata: { name: "Test" },
          books: [
            {
              id: "psalms",
              name: "Psalms",
              chapters: 2,
              versesPerChapter: [1, 1],
            },
          ],
        }),
      );
      const audio = path.join(directory, "audio/kjv");
      await fs.mkdir(audio, { recursive: true });
      for (const chapter of [1, 2]) {
        await fs.writeFile(
          path.join(bible, `psalms/${chapter}.json`),
          JSON.stringify([{ verse: 1, text: "Test Bible reading" }]),
        );
        await execute("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=2",
          "-y",
          path.join(audio, `01-psalms-${chapter}.mp3`),
        ]);
      }
      const provider = path.join(directory, "provider.mjs");
      await fs.writeFile(
        provider,
        `import fs from 'node:fs/promises';
const arg=key=>process.argv[process.argv.indexOf(key)+1];
const input=JSON.parse(await fs.readFile(arg('--request'),'utf8'));
console.log(JSON.stringify({progress:45})); await new Promise(resolve=>setTimeout(resolve,500));
await fs.writeFile(arg('--output'),JSON.stringify({model:'fixture',chapters:input.chapters.map(c=>({index:c.index,segments:c.segments.map(s=>({id:s.id,words:[{text:s.text,start:0.15,end:1.5}]}))}))}));`,
      );
      const socket = net.createServer();
      socket.listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = (socket.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => socket.close(() => resolve()));
      const token = "alignment-test-token-12345678901234567890";
      const env = {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("VIDEO_"),
          ),
        ),
        PORT: String(port),
        API_TOKEN: token,
        API_PROXY_CHILD: "1",
        WORKING_DIR: directory,
        SHORTS_DIR_NAME: "short",
        LONGS_DIR_NAME: "long",
        VIDEO_AUDIO_DIR: path.dirname(audio),
        VIDEO_ALIGNER_PYTHON: process.execPath,
        VIDEO_ALIGNER_SCRIPT: provider,
      };
      // Local credentials and startup markers cannot replace proxy-provided settings.
      await fs.writeFile(
        path.join(isolated, ".env"),
        "API_TOKEN=local-token-that-must-never-be-used-123456\nAPI_PROXY_CHILD=1\nPORT=1\nWORKING_DIR=/ignored-local-root\n",
      );
      for (const overrides of [{ API_PROXY_CHILD: "" }, { API_TOKEN: "" }])
        await assert.rejects(
          execute(process.execPath, ["--import", "tsx", "src/server.ts"], {
            cwd: isolated,
            env: { ...env, ...overrides },
          }),
          { message: /Start this service through pnpm start:api-proxy/ },
        );
      const start = async () => {
        child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
          cwd: isolated,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let diagnostics = "";
        child.stderr!.on("data", (chunk) => {
          diagnostics += chunk;
        });
        await new Promise<void>((resolve, reject) => {
          child!.stdout!.on("data", (chunk) => {
            if (String(chunk).includes("Video API:")) resolve();
          });
          child!.once("error", reject);
          child!.once("exit", () => reject(new Error(diagnostics)));
        });
      };
      await start();
      const base = `http://127.0.0.1:${port}`;
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const input = {
        projectId: 1,
        kind: "short",
        outputEnvironment: "development",
        version: { id: "kjv", locale: "en", label: "Test" },
        passage: {
          id: "test",
          book: "psalms",
          start: { chapter: 1, verse: 1 },
          end: { chapter: 2, verse: 1 },
        },
        settings: {},
        voiceTemplates: { intro: "Intro", outro: "Outro" },
      };
      const route = `${base}/v1/projects/1/alignment`;
      assert.equal((await fetch(route, { method: "POST" })).status, 401);
      const submit = (extra = {}) =>
        fetch(route, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...input, ...extra }),
        });
      const queued = await submit({ sectionIndex: 1 });
      assert.equal(queued.status, 202);
      const first = (await queued.json()).job;
      assert.equal((await submit()).status, 409);
      assert.equal((await submit({ sectionIndex: 1 })).status, 409);
      const next = await submit({ sectionIndex: 0 });
      assert.equal(next.status, 202);
      const second = (await next.json()).job;
      assert.notEqual(second.id, first.id);
      const rendering = await fetch(`${base}/v1/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...input, id: crypto.randomUUID() }),
      });
      assert.equal(rendering.status, 409);
      const queue = await (
        await fetch(`${base}/v1/queue?outputEnvironment=development`, {
          headers,
        })
      ).json();
      assert.deepEqual(
        queue.items.map((item: { type: string }) => item.type),
        ["alignment-1", "alignment-0"],
      );
      const read = async (environment = "development") =>
        (
          await (
            await fetch(
              `${route}?kind=short&outputEnvironment=${environment}`,
              { headers },
            )
          ).json()
        ).job;
      assert.equal(await read("production"), null);
      const readAll = async () =>
        (
          await (
            await fetch(`${route}?kind=short&outputEnvironment=development`, {
              headers,
            })
          ).json()
        ).jobs;
      const finish = async (id?: string) => {
        for (let i = 0; i < 100; i++) {
          const job = id
            ? (await readAll()).find((job: { id: string }) => job.id === id)
            : await read();
          if (["done", "failed"].includes(job.status)) return job;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error("Alignment did not finish");
      };
      const completed = await finish(first.id);
      assert.equal(completed.status, "done");
      assert.equal(completed.id, first.id);
      assert.deepEqual(
        completed.result.offsets.map((v: { reference: string }) => v.reference),
        ["Psalms 2:1"],
      );
      const secondCompleted = await finish(second.id);
      assert.equal(secondCompleted.status, "done");
      assert.deepEqual(
        secondCompleted.result.offsets.map(
          (v: { reference: string }) => v.reference,
        ),
        ["Psalms 1:1"],
      );
      child!.kill("SIGTERM");
      await once(child!, "exit");
      await start();
      const retained = await readAll();
      assert.deepEqual(
        retained.find((job: { id: string }) => job.id === first.id),
        completed,
      );
      assert.deepEqual(
        retained.find((job: { id: string }) => job.id === second.id),
        secondCompleted,
      );
      assert.equal((await submit()).status, 202);
      const all = await finish();
      assert.equal(all.status, "done");
      assert.equal(all.result.offsets.length, 2);
      assert.equal((await submit({ sectionIndex: 99 })).status, 202);
      assert.equal((await finish()).status, "failed");
      assert.equal((await submit({ sectionIndex: 0 })).status, 202);
      assert.equal((await finish()).status, "done");
      assert.equal((await submit({ sectionIndex: 0 })).status, 202);
      child!.kill("SIGTERM");
      await once(child!, "exit");
      await start();
      const interrupted = await read();
      assert.equal(interrupted.status, "failed");
      assert.equal(interrupted.stage, "Interrupted");
      assert.equal((await submit({ sectionIndex: 1 })).status, 202);
      assert.equal((await finish()).status, "done");
    } finally {
      if (child && child.exitCode === null) {
        child.kill("SIGTERM");
        await once(child, "exit");
      }
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
