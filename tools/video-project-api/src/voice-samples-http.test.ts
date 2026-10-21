import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { narrationPresets } from "./narration-parameters.js";

test(
  "generated examples persist, use selected base/model/parameters and preserve the last audio on failure",
  { timeout: 30000 },
  async () => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "voice-samples-http-"),
    );
    const source = fileURLToPath(new URL("..", import.meta.url));
    const isolated = path.join(directory, "tools/video-project-api");
    const voices = path.join(directory, "material/voices");
    let child: ReturnType<typeof spawn> | undefined;
    const socket = net.createServer();
    try {
      await fs.mkdir(isolated, { recursive: true });
      await fs.cp(path.join(source, "src"), path.join(isolated, "src"), {
        recursive: true,
      });
      await fs.copyFile(
        path.join(source, "package.json"),
        path.join(isolated, "package.json"),
      );
      await fs.symlink(
        path.join(source, "node_modules"),
        path.join(isolated, "node_modules"),
      );
      await fs.mkdir(voices, { recursive: true });
      for (const name of [
        "es-1.mp3",
        "es-2.mp3",
        "en-1.mp3",
        "pt-1.mp3",
        "es-intro.mp3",
      ])
        await fs.writeFile(path.join(voices, name), `original-${name}`);
      const worker = path.join(directory, "worker.mjs");
      await fs.writeFile(
        worker,
        `import fs from 'node:fs/promises'; import path from 'node:path';
const arg=k=>process.argv[process.argv.indexOf(k)+1];
const scripts=JSON.parse(await fs.readFile(arg('--scripts'),'utf8'));
const prompts=JSON.parse(await fs.readFile(arg('--voice-prompts'),'utf8'));
await fs.appendFile(process.env.SAMPLE_LOG,JSON.stringify({args:process.argv,scripts,prompts})+'\\n');
await new Promise(r=>setTimeout(r,150));
if(scripts.intro==='fail') process.exit(1);
await fs.writeFile(path.join(arg('--output-dir'),'intro.wav'),'RIFF-generated-'+scripts.intro);
`,
      );
      socket.listen(0, "127.0.0.1");
      await once(socket, "listening");
      const port = (socket.address() as net.AddressInfo).port;
      await new Promise<void>((resolve) => socket.close(() => resolve()));
      const token = "voice-samples-test-token-123456789012345";
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const base = `http://127.0.0.1:${port}/v1/base-voices`;
      const start = async () => {
        child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
          cwd: isolated,
          env: {
            ...process.env,
            PORT: String(port),
            API_TOKEN: token,
            API_PROXY_CHILD: "1",
            WORKING_DIR: directory,
            VIDEO_TTS_SCRIPT: worker,
            VIDEO_SHORT_TTS_PYTHON: process.execPath,
            SAMPLE_LOG: path.join(directory, "calls.jsonl"),
          },
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
      const stop = async () => {
        const ended = once(child!, "exit");
        child!.kill("SIGTERM");
        await ended;
        child = undefined;
      };
      await start();
      assert.equal((await fetch(base)).status, 401);
      const disabledReading = await fetch(
        `http://127.0.0.1:${port}/v1/projects/1/voices`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            projectId: 1,
            kind: "short",
            version: { id: "rv1909", locale: "es", label: "Bible" },
            passage: {
              id: "reading",
              book: "genesis",
              start: { chapter: 1, verse: 1 },
              end: { chapter: 1, verse: 1 },
            },
            settings: {},
            part: "reading-0",
          }),
        },
      );
      assert.equal(disabledReading.status, 400);

      const catalog = async () =>
        (await (await fetch(base, { headers })).json()).voices as any[];
      assert.deepEqual(
        (await catalog()).map((voice) => voice.id),
        ["en-1", "es-1", "es-2", "pt-1"],
      );
      assert.equal(
        (await fetch(`${base}/es-1/sample`, { headers })).status,
        404,
      );
      const request = (
        voice: string,
        text: string,
        voiceModel = "multilingual-v3",
        voiceDecoder?: "general" | "v3",
      ) =>
        fetch(`${base}/${voice}/sample`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            text,
            voiceModel,
            voiceDecoder,
            voiceParameters: narrationPresets.expressive,
          }),
        });
      const settled = async (id: string) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const voice = (await catalog()).find((item) => item.id === id);
          if (!["queued", "running"].includes(voice.status)) return voice;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error("Sample generation timed out");
      };
      assert.equal(
        (await request("es-2", "A literal {example}.", "latam", "v3")).status,
        202,
      );
      assert.equal((await request("es-2", "duplicate")).status, 202);
      assert.equal((await settled("es-2")).available, true);
      const audio = await (
        await fetch(`${base}/es-2/sample`, { headers })
      ).text();
      assert.equal(audio, "RIFF-generated-A literal {example}.");
      const calls = (
        await fs.readFile(path.join(directory, "calls.jsonl"), "utf8")
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].prompts.intro, path.join(voices, "es-2.mp3"));
      assert.equal(
        calls[0].args[calls[0].args.indexOf("--model") + 1],
        "latam",
      );
      assert.equal(
        calls[0].args[calls[0].args.indexOf("--audio-decoder") + 1],
        "v3",
      );
      const metadata = JSON.parse(
        await fs.readFile(
          path.join(voices, "samples/es-2-sample.wav.json"),
          "utf8",
        ),
      );
      assert.equal(metadata.voiceDecoder, "v3");
      for (const [key, value] of Object.entries(narrationPresets.expressive))
        assert.equal(
          calls[0].args[
            calls[0].args.indexOf("--" + key.replaceAll("_", "-")) + 1
          ],
          String(value),
        );
      assert.equal(
        await fs.readFile(path.join(voices, "es-2.mp3"), "utf8"),
        "original-es-2.mp3",
      );
      await request("es-2", "Regenerated example.");
      assert.equal((await settled("es-2")).text, "Regenerated example.");
      const regenerated = await fs.readFile(
        path.join(voices, "samples/es-2-sample.wav"),
        "utf8",
      );
      await request("es-2", "fail");
      assert.equal((await settled("es-2")).status, "failed");
      assert.equal(
        await fs.readFile(path.join(voices, "samples/es-2-sample.wav"), "utf8"),
        regenerated,
      );
      await stop();
      await start();
      const cached = (await catalog()).find((voice) => voice.id === "es-2");
      assert.equal(cached.available, true);
      assert.equal(cached.text, "Regenerated example.");
      assert.equal((await request("es-99", "Missing.")).status, 500);
      assert.equal(
        (await request("en-1", "Invalid language model.", "latam")).status,
        400,
      );
      await stop();
    } finally {
      if (child) {
        const ended = once(child, "exit");
        child.kill("SIGTERM");
        await ended;
      }
      socket.close();
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
