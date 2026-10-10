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
      const openUrl = `${base}/v1/projects/1/open-folder`;
      assert.equal((await fetch(openUrl, { method: "POST" })).status, 401);
      const openRequest = {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "short",
          version: "rv1909",
          slug: "missing-project",
          outputEnvironment: "development",
        }),
      };
      assert.equal((await fetch(openUrl, openRequest)).status, 409);
      assert.equal(
        (
          await fetch(openUrl, {
            ...openRequest,
            body: JSON.stringify({
              kind: "short",
              version: "rv1909",
              slug: "../escape",
              outputEnvironment: "development",
            }),
          })
        ).status,
        400,
      );
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
      const finalVideos = async (outputEnvironment: string) => {
        const response = await fetch(`${base}/v1/projects/final-videos`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            outputEnvironment,
            projects: [
              { id: 1, kind: "short", version: "rv1909", slug: "john-3-16" },
              {
                id: 2,
                kind: "short",
                version: "rv1909",
                slug: "missing-video",
              },
              { id: 3, kind: "long", version: "rv1909", slug: "john-3-16" },
            ],
          }),
        });
        assert.equal(response.status, 200);
        return response.json();
      };
      assert.deepEqual(await finalVideos("production"), {
        projects: [
          { id: 1, rendered: true },
          { id: 2, rendered: false },
          { id: 3, rendered: false },
        ],
      });
      assert.deepEqual(await finalVideos("development"), {
        projects: [
          { id: 1, rendered: false },
          { id: 2, rendered: false },
          { id: 3, rendered: false },
        ],
      });

      const queue = await fetch(`${base}/v1/queue`, { headers });
      assert.deepEqual((await queue.json()).summary, {
        progress: 0,
        completed: 0,
        total: 0,
      });
      assert.equal(data.result.descriptions["3-youtube.txt"], "Caption");
      const voices = await fetch(`${base}/v1/projects/1/voices?${query}`, {
        headers,
      });
      const voiceData = (await voices.json()).voices;
      assert.equal(voiceData.intro.available, true);
      assert.equal(voiceData.intro.progress, 100);
      assert.equal(voiceData.outro.progress, 0);
      const bibleIndex = JSON.parse(
        await fs.readFile(
          new URL(
            "../../../apps/frontend/public/bible-data/es/rv1909/index.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const firstChapterVerses = bibleIndex.books.find(
        (book: { id: string }) => book.id === "genesis",
      ).versesPerChapter[0];
      const cache = path.join(directory, "long/cache/chapter-voices/es");
      await fs.mkdir(cache, { recursive: true });
      await fs.writeFile(
        path.join(cache, "chapter-1.wav"),
        "cached chapter one",
      );
      const savedRange = {
        id: "cached-first-chapter",
        book: "genesis",
        start: { chapter: 1, verse: 1 },
        end: { chapter: 1, verse: firstChapterVerses },
      };
      const longQuery = new URLSearchParams({
        kind: "long",
        version: "rv1909",
        locale: "es",
        passage: savedRange.id,
        passageRange: JSON.stringify(savedRange),
        outputEnvironment: "development",
      });
      const cachedVoices = await fetch(
        `${base}/v1/projects/7/voices?${longQuery}`,
        { headers },
      );
      assert.equal(cachedVoices.status, 200);
      const cachedState = (await cachedVoices.json()).voices["chapter-0"];
      assert.equal(cachedState.available, true);
      assert.equal(cachedState.cached, true);
      const cachedAudio = await fetch(
        `${base}/v1/projects/7/media/chapter-0?${longQuery}`,
        { headers },
      );
      assert.equal(cachedAudio.status, 200);
      assert.equal(await cachedAudio.text(), "cached chapter one");
      await assert.rejects(
        fs.stat(
          path.join(directory, "long/outputs-dev/rv1909/cached-first-chapter"),
        ),
        { code: "ENOENT" },
      );
      longQuery.set(
        "passageRange",
        JSON.stringify({ ...savedRange, end: { chapter: 1, verse: 2 } }),
      );
      const partialVoices = await fetch(
        `${base}/v1/projects/7/voices?${longQuery}`,
        { headers },
      );
      const partialState = (await partialVoices.json()).voices["chapter-0"];
      assert.equal(partialState.available, false);
      assert.equal(partialState.cached, false);
      const renderInput = {
        id: "f862d477-633d-42a3-bb24-73c14a833fed",
        projectId: 1,
        kind: "short",
        outputEnvironment: "production",
        version: { id: "rv1909", locale: "es", label: "Reina Valera" },
        passage: {
          id: "john-3-16",
          book: "john",
          start: { chapter: 3, verse: 16 },
          end: { chapter: 3, verse: 16 },
        },
        settings: { reuseVoices: false, clipAudioMode: "video" },
      };
      const submitRender = (input = renderInput) =>
        fetch(`${base}/v1/jobs`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
      // Even legacy requests cannot bypass the requirement for both narration files.
      const missingVoice = await submitRender();
      assert.equal(missingVoice.status, 400);
      assert.equal(
        (await missingVoice.json()).error,
        "Generate the introduction and closing voices before generating the video.",
      );
      await fs.writeFile(path.join(output, "_internal/3-outro.wav"), "");
      assert.equal((await submitRender()).status, 400);
      await fs.writeFile(path.join(output, "_internal/3-outro.wav"), "voice");
      // Production narration must never make a development render eligible.
      assert.equal(
        (
          await submitRender({
            ...renderInput,
            outputEnvironment: "development",
          })
        ).status,
        400,
      );
      const rejectedQueue = await fetch(`${base}/v1/queue`, { headers });
      assert.equal((await rejectedQueue.json()).summary.total, 0);
      const media = await fetch(`${base}/v1/projects/1/media/video?${query}`, {
        headers,
      });
      assert.equal(media.status, 200);
      assert.equal(await media.text(), "video");
      await fs.writeFile(path.join(output, "0-short.mp4"), "numbered video");
      await fs.writeFile(
        path.join(output, "0-thumbnail.jpg"),
        "numbered thumbnail",
      );
      await fs.writeFile(path.join(output, "3-youtube.txt"), "Updated caption");
      const numberedMedia = await fetch(
        `${base}/v1/projects/1/media/video?${query}`,
        { headers: { ...headers, Range: "bytes=0-7" } },
      );
      assert.equal(numberedMedia.status, 206);
      assert.equal(await numberedMedia.text(), "numbered");
      await fs.unlink(path.join(output, "short.mp4"));
      assert.equal(
        (await finalVideos("production")).projects[0].rendered,
        true,
      );

      const thumbnail = await fetch(
        `${base}/v1/projects/1/media/thumbnail?${query}`,
        { headers },
      );
      assert.equal(thumbnail.status, 200);
      assert.equal(await thumbnail.text(), "numbered thumbnail");
      const numberedState = await fetch(
        `${base}/v1/projects/1/state?${query}`,
        { headers },
      );
      const numberedResult = (await numberedState.json()).result;
      assert.equal(numberedResult.video, path.join(output, "0-short.mp4"));
      assert.equal(
        numberedResult.descriptions["3-youtube.txt"],
        "Updated caption",
      );
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
