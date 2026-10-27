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
import { cosyDefaults, qwenDefaults } from "./narration-model-settings.js";

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
if(scripts.intro==='Queued English example.') { while(!(await fs.stat(process.env.SAMPLE_LOG+'.english-release').catch(()=>null))) await new Promise(r=>setTimeout(r,10)); }
if(scripts.intro==='A literal {example}.') { while(!(await fs.stat(process.env.SAMPLE_LOG+'.release').catch(()=>null))) await new Promise(r=>setTimeout(r,10)); }
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
            VIDEO_QWEN_TTS_PYTHON: process.execPath,
            VIDEO_COSYVOICE_TTS_PYTHON: process.execPath,
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
      assert.equal((await fetch(`${base}/about`)).status, 401);
      assert.equal((await fetch(`${base}/es-1/original`)).status, 401);
      const original = await fetch(`${base}/es-1/original`, { headers });
      assert.equal(original.headers.get("Content-Type"), "audio/mpeg");
      assert.equal(original.headers.get("Accept-Ranges"), "bytes");
      assert.equal(await original.text(), "original-es-1.mp3");
      const partial = await fetch(`${base}/es-1/original`, {
        headers: { ...headers, Range: "bytes=9-12" },
      });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get("Content-Range"), "bytes 9-12/17");
      assert.equal(await partial.text(), "es-1");
      const suffix = await fetch(`${base}/es-1/original`, {
        headers: { ...headers, Range: "bytes=-3" },
      });
      assert.equal(await suffix.text(), "mp3");
      assert.equal(
        (
          await fetch(`${base}/es-1/original`, {
            headers: { ...headers, Range: "bytes=999-" },
          })
        ).status,
        416,
      );
      assert.equal(
        (await fetch(`${base}/es-999/original`, { headers })).status,
        404,
      );
      const head = await fetch(`${base}/es-1/original`, {
        method: "HEAD",
        headers,
      });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), "");
      assert.equal(
        await fs.stat(path.join(directory, "calls.jsonl")).catch(() => null),
        null,
      );

      assert.equal((await fetch(`${base}/about`, { headers })).status, 404);
      const information = path.join(voices, "voices.md");
      const markdown =
        "# Voices\n\n## English\n\n1. A **warm** voice\n\n```text\nExample narration.\n```";
      await fs.writeFile(information, markdown);
      const about = await fetch(`${base}/about`, { headers });
      assert.equal(about.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await about.json(), { markdown });
      await fs.writeFile(information, "# Updated voices");
      assert.deepEqual(
        await (await fetch(`${base}/about`, { headers })).json(),
        { markdown: "# Updated voices" },
      );
      assert.deepEqual(
        await (
          await fetch(`${base}/about?file=../../other.md`, { headers })
        ).json(),
        { markdown: "# Updated voices" },
      );

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
        voiceParameters = narrationPresets.expressive as import("./narration-parameters.js").NarrationParameters,
      ) =>
        fetch(`${base}/${voice}/sample`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            text,
            voiceModel,
            voiceDecoder,
            voiceParameters,
          }),
        });
      const settled = async (id: string, save = true) => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const voice = (await catalog()).find((item) => item.id === id);
          if (!["queued", "running"].includes(voice.status)) {
            // Most existing assertions exercise saved samples; explicitly promote
            // their previews so generation itself never replaces a saved file.
            if (save) {
              for (const sample of voice.samples) {
                if (!sample.preview || sample.status !== "done") continue;
                const saved = await fetch(`${base}/${id}/sample`, {
                  method: "PUT",
                  headers,
                  body: JSON.stringify({
                    model: sample.voiceModel,
                    previewId: sample.preview.id,
                  }),
                });
                assert.equal(saved.status, 200, await saved.text());
              }
              return (await catalog()).find((item) => item.id === id);
            }
            return voice;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error("Sample generation timed out");
      };
      const response = await request(
        "es-2",
        "A literal {example}.",
        "latam",
        "v3",
      );
      assert.equal(response.status, 202);
      const task = await response.json();
      const duplicate = await request("es-2", "duplicate", "latam", "v3");
      assert.equal(duplicate.status, 202);
      assert.equal((await duplicate.json()).id, task.id);
      const queueSnapshot = async (environment = "production") => {
        const response = await fetch(
          `http://127.0.0.1:${port}/v1/queue?outputEnvironment=${environment}`,
          { headers },
        );
        assert.equal(response.status, 200);
        return response.json();
      };
      const active = await queueSnapshot();
      assert.equal(active.items.length, 1);
      assert.equal(active.items[0].id, task.id);
      assert.equal(active.items[0].type, "voice-sample");
      assert.equal(active.items[0].projectId, null);
      assert.equal(active.items[0].voice, "es-2");
      assert.equal(active.items[0].locale, "es");
      assert.equal(active.items[0].status, "running");
      assert.equal(active.summary.total, 1);
      assert.equal((await queueSnapshot("development")).items.length, 0);
      // A second sample must wait behind the active one, rather than synthesize concurrently.
      const waiting = await request("en-1", "Queued English example.");
      assert.equal(waiting.status, 202);
      const before = await queueSnapshot();
      assert.deepEqual(
        before.items.map((item: any) => [
          item.voice,
          item.status,
          item.position,
        ]),
        [
          ["es-2", "running", null],
          ["en-1", "queued", 1],
        ],
      );
      assert.equal(before.summary.total, 2);
      await fs.writeFile(
        path.join(directory, "calls.jsonl.release"),
        "release",
      );
      const firstPreview = await settled("es-2", false);
      assert.equal(firstPreview.available, false);
      const firstId = firstPreview.samples.find(
        (sample: any) => sample.voiceModel === "latam",
      ).preview.id;
      assert.equal(
        (await fetch(`${base}/es-2/sample?model=latam`, { headers })).status,
        404,
      );
      assert.equal(
        await (
          await fetch(`${base}/es-2/sample?model=latam&preview=${firstId}`, {
            headers,
          })
        ).text(),
        "RIFF-generated-A literal {example}.",
      );
      assert.equal((await settled("es-2")).available, true);
      await fs.writeFile(
        path.join(directory, "calls.jsonl.english-release"),
        "release",
      );
      assert.equal((await settled("en-1")).available, true);
      const audio = await (
        await fetch(`${base}/es-2/sample`, { headers })
      ).text();
      assert.equal(audio, "RIFF-generated-A literal {example}.");
      const calls = (
        await fs.readFile(path.join(directory, "calls.jsonl"), "utf8")
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .filter((call) => call.prompts.intro === path.join(voices, "es-2.mp3"));
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
          path.join(voices, "samples/es-2-latam-sample.wav.json"),
          "utf8",
        ),
      );
      assert.equal(metadata.voiceDecoder, "v3");
      assert.equal(metadata.voiceProvider, "chatterbox");
      assert.equal(metadata.voiceModel, "latam");
      assert.equal(
        metadata.voiceModelName,
        "Chatterbox Multilingual es-MX Latam",
      );
      assert.equal(
        metadata.voiceModelRepository,
        "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
      );
      assert.equal(metadata.voiceModelCheckpoint, "t3_es_mx_latam.safetensors");
      assert.deepEqual(metadata.voiceParameters, narrationPresets.expressive);
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
        path.join(voices, "samples/es-2-multilingual-v3-sample.wav"),
        "utf8",
      );
      await request("es-2", "fail");
      assert.equal((await settled("es-2")).status, "failed");
      assert.equal(
        await fs.readFile(
          path.join(voices, "samples/es-2-multilingual-v3-sample.wav"),
          "utf8",
        ),
        regenerated,
      );
      assert.equal((await settled("en-1")).available, true);
      const history = await queueSnapshot();
      assert.deepEqual(
        history.items
          .filter((item: any) => item.voice === "es-2")
          .map((item: any) => item.status),
        ["done", "done", "failed"],
      );
      assert.ok(history.items.every((item: any) => item.finishedAt));
      assert.equal(history.summary.completed, history.summary.total);
      // Metadata must record the same effective parameters passed to synthesis,
      // excluding the legacy Chatterbox values and other models' preset views.
      for (const model of ["qwen3-base-0.6b", "qwen3-base-1.7b"]) {
        const expected = {
          ...qwenDefaults,
          temperature: 0.65,
          top_p: 0.85,
          top_k: 23,
          repetition_penalty: 1.15,
          max_new_tokens: 1536,
        };
        const parameters = {
          ...narrationPresets.expressive,
          modelSettings: {
            [model]: expected,
            "multilingual-v3": narrationPresets.relaxed,
          },
        };
        const response = await request(
          "pt-1",
          `Example ${model}.`,
          model,
          undefined,
          parameters,
        );
        assert.equal(response.status, 202);
        assert.equal((await settled("pt-1")).status, "done");
        const saved = JSON.parse(
          await fs.readFile(
            path.join(voices, `samples/pt-1-${model}-sample.wav.json`),
            "utf8",
          ),
        );
        assert.equal(saved.voiceModel, model);
        assert.equal(saved.voiceProvider, "qwen3");
        const size = model === "qwen3-base-0.6b" ? "0.6B" : "1.7B";
        assert.equal(saved.voiceModelName, `Qwen3-TTS 12Hz Base ${size}`);
        assert.equal(
          saved.voiceModelRepository,
          `Qwen/Qwen3-TTS-12Hz-${size}-Base`,
        );
        assert.equal(saved.voiceModelCheckpoint, undefined);
        assert.deepEqual(saved.voiceParameters, expected);
        assert.equal(saved.voiceDecoder, undefined);
        const call = (
          await fs.readFile(path.join(directory, "calls.jsonl"), "utf8")
        )
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
          .at(-1);
        assert.equal(call.args[call.args.indexOf("--model") + 1], model);
        for (const [key, value] of Object.entries(saved.voiceParameters)) {
          assert.equal(
            call.args[call.args.indexOf("--" + key.replaceAll("_", "-")) + 1],
            String(value),
          );
        }
        for (const flag of ["--exaggeration", "--cfg-weight", "--min-p"])
          assert.ok(!call.args.includes(flag));
      }
      // Built-in presets without a model-specific view use Qwen defaults.
      await request("pt-1", "Default Qwen example.", "qwen3-base-0.6b");
      assert.equal((await settled("pt-1")).status, "done");
      const defaultsMetadata = JSON.parse(
        await fs.readFile(
          path.join(voices, "samples/pt-1-qwen3-base-0.6b-sample.wav.json"),
          "utf8",
        ),
      );
      assert.deepEqual(defaultsMetadata.voiceParameters, qwenDefaults);
      const variants = (await catalog()).find(
        (voice) => voice.id === "pt-1",
      ).samples;
      assert.deepEqual(
        variants
          .filter((sample: any) => sample.available)
          .map((sample: any) => sample.voiceModel)
          .sort(),
        ["qwen3-base-0.6b", "qwen3-base-1.7b"],
      );
      const readSample = async (model: string) => {
        const response = await fetch(`${base}/pt-1/sample?model=${model}`, {
          headers,
        });
        assert.equal(response.status, 200);
        return response.text();
      };
      assert.equal(
        await readSample("qwen3-base-0.6b"),
        "RIFF-generated-Default Qwen example.",
      );
      assert.equal(
        await readSample("qwen3-base-1.7b"),
        "RIFF-generated-Example qwen3-base-1.7b.",
      );
      assert.equal(
        (await fetch(`${base}/pt-1/sample?model=multilingual-v3`, { headers }))
          .status,
        404,
      );
      assert.equal(
        (await fetch(`${base}/pt-1/sample?model=invalid`, { headers })).status,
        400,
      );
      const preservedMetadata = JSON.parse(
        await fs.readFile(
          path.join(voices, "samples/pt-1-qwen3-base-1.7b-sample.wav.json"),
          "utf8",
        ),
      );
      assert.equal(preservedMetadata.voiceParameters.top_k, 23);
      assert.equal(preservedMetadata.text, "Example qwen3-base-1.7b.");
      assert.deepEqual(
        (await fs.readdir(path.join(voices, "samples")))
          .filter((name) => name.startsWith("pt-1-"))
          .sort(),
        [
          "pt-1-qwen3-base-0.6b-sample.wav",
          "pt-1-qwen3-base-0.6b-sample.wav.json",
          "pt-1-qwen3-base-1.7b-sample.wav",
          "pt-1-qwen3-base-1.7b-sample.wav.json",
        ],
      );
      for (const model of ["cosyvoice3-base-0.5b", "cosyvoice3-rl-0.5b"]) {
        const parameters = {
          ...narrationPresets.natural,
          modelSettings: {
            [model]: {
              ...cosyDefaults,
              speed: 0.9,
              mode: "instruct",
              instructions: "Speak calmly and clearly.",
            },
          },
        };
        assert.equal(
          (
            await request(
              "en-1",
              `Cosy ${model}.`,
              model,
              undefined,
              parameters,
            )
          ).status,
          202,
        );
        await settled("en-1");
        const metadata = JSON.parse(
          await fs.readFile(
            path.join(voices, `samples/en-1-${model}-sample.wav.json`),
            "utf8",
          ),
        );
        assert.equal(metadata.voiceProvider, "cosyvoice3");
        assert.equal(
          metadata.voiceModelCheckpoint,
          model.includes("-rl-") ? "llm.rl.pt" : "llm.pt",
        );
        assert.deepEqual(
          metadata.voiceParameters,
          parameters.modelSettings[model],
        );
        assert.equal(metadata.voiceDecoder, undefined);
        assert.equal(
          await (
            await fetch(`${base}/en-1/sample?model=${model}`, { headers })
          ).text(),
          `RIFF-generated-Cosy ${model}.`,
        );
      }
      assert.equal(
        (await request("pt-1", "Unsupported language.", "cosyvoice3-base-0.5b"))
          .status,
        400,
      );
      // A legacy pair is attributable only to its recorded model, and remains untouched.
      const legacyFile = path.join(voices, "samples/es-1-sample.wav");
      await fs.writeFile(legacyFile, "legacy audio");
      await fs.writeFile(
        legacyFile + ".json",
        JSON.stringify({
          voiceModel: "latam",
          text: "Legacy example.",
          voiceParameters: narrationPresets.natural,
        }),
      );
      assert.equal(
        await (
          await fetch(`${base}/es-1/sample?model=latam`, { headers })
        ).text(),
        "legacy audio",
      );
      assert.equal(
        (await fetch(`${base}/es-1/sample?model=qwen3-base-1.7b`, { headers }))
          .status,
        404,
      );
      await request("es-1", "A new model.", "qwen3-base-1.7b");
      assert.equal((await settled("es-1")).status, "done");
      assert.equal(await fs.readFile(legacyFile, "utf8"), "legacy audio");
      // Different models of one voice are separate queued jobs, but repeat requests
      // for the same voice/model still share the active job.
      await fs.unlink(path.join(directory, "calls.jsonl.release"));
      const holding = await request(
        "es-1",
        "A literal {example}.",
        "qwen3-base-0.6b",
      );
      const holdingTask = await holding.json();
      const otherModel = await request(
        "es-1",
        "Another model example.",
        "qwen3-base-1.7b",
      );
      const otherTask = await otherModel.json();
      assert.notEqual(otherTask.id, holdingTask.id);
      const duplicateModel = await request(
        "es-1",
        "duplicate",
        "qwen3-base-1.7b",
      );
      assert.equal((await duplicateModel.json()).id, otherTask.id);
      await fs.writeFile(
        path.join(directory, "calls.jsonl.release"),
        "release",
      );
      await settled("es-1");

      await stop();
      await start();
      const cached = (await catalog()).find((voice) => voice.id === "es-2");
      assert.equal(cached.available, true);
      assert.equal(cached.text, "Regenerated example.");
      assert.equal(
        await readSample("qwen3-base-0.6b"),
        "RIFF-generated-Default Qwen example.",
      );
      assert.equal(
        await readSample("qwen3-base-1.7b"),
        "RIFF-generated-Example qwen3-base-1.7b.",
      );

      // Auditioning new text leaves the permanent pair byte-for-byte intact.
      const savedFile = path.join(
        voices,
        "samples/es-2-multilingual-v3-sample.wav",
      );
      const savedBytes = await fs.readFile(savedFile);
      const savedMetadata = await fs.readFile(savedFile + ".json", "utf8");
      assert.ok(savedMetadata.includes('\n  "voice"'));
      await request("es-2", "Temporary audition.");
      let audition = (await settled("es-2", false)).samples.find(
        (sample: any) => sample.voiceModel === "multilingual-v3",
      ).preview;
      assert.deepEqual(await fs.readFile(savedFile), savedBytes);
      assert.equal(
        await fs.readFile(savedFile + ".json", "utf8"),
        savedMetadata,
      );
      assert.equal(
        await (
          await fetch(
            `${base}/es-2/sample?model=multilingual-v3&preview=${audition.id}`,
            { headers },
          )
        ).text(),
        "RIFF-generated-Temporary audition.",
      );
      const oldId = audition.id;
      await request("es-2", "Second temporary audition.");
      const duringGeneration = await fetch(`${base}/es-2/sample`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ model: "multilingual-v3", previewId: oldId }),
      });
      assert.equal(duringGeneration.status, 409);
      audition = (await settled("es-2", false)).samples.find(
        (sample: any) => sample.voiceModel === "multilingual-v3",
      ).preview;
      assert.notEqual(audition.id, oldId);
      const staleSave = await fetch(`${base}/es-2/sample`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ model: "multilingual-v3", previewId: oldId }),
      });
      assert.equal(staleSave.status, 409);
      assert.equal(
        (
          await fetch(
            `${base}/es-2/sample?model=multilingual-v3&preview=${oldId}`,
            { headers },
          )
        ).status,
        404,
      );
      assert.deepEqual(await fs.readFile(savedFile), savedBytes);
      assert.equal(
        (await fs.readdir(path.join(voices, "samples"))).filter((name) =>
          /^es-2-multilingual-v3-preview-.*\.wav$/.test(name),
        ).length,
        1,
      );
      // A failed audition retains both the saved sample and the last usable preview.
      await request("es-2", "fail");
      const failedAudition = (await settled("es-2", false)).samples.find(
        (sample: any) => sample.voiceModel === "multilingual-v3",
      );
      assert.equal(failedAudition.status, "failed");
      assert.equal(failedAudition.preview.id, audition.id);
      assert.deepEqual(await fs.readFile(savedFile), savedBytes);
      // Temporary samples survive service restarts but stay unpublished.
      await stop();
      await start();
      const restarted = (await catalog())
        .find((voice) => voice.id === "es-2")
        .samples.find((sample: any) => sample.voiceModel === "multilingual-v3");
      assert.equal(restarted.preview.id, audition.id);
      assert.equal(restarted.text, "Regenerated example.");
      const promoted = await fetch(`${base}/es-2/sample`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          model: "multilingual-v3",
          previewId: audition.id,
        }),
      });
      assert.equal(promoted.status, 200, await promoted.text());
      assert.equal(
        await fs.readFile(savedFile, "utf8"),
        "RIFF-generated-Second temporary audition.",
      );
      const promotedMetadata = JSON.parse(
        await fs.readFile(savedFile + ".json", "utf8"),
      );
      assert.equal(promotedMetadata.text, "Second temporary audition.");
      assert.equal(promotedMetadata.previewId, undefined);
      assert.equal(
        (
          await fetch(
            `${base}/es-2/sample?model=multilingual-v3&preview=${audition.id}`,
            { headers },
          )
        ).status,
        404,
      );
      assert.equal(
        await (
          await fetch(`${base}/es-2/sample?model=latam`, { headers })
        ).text(),
        "RIFF-generated-A literal {example}.",
      );
      assert.equal(
        await fs.readFile(path.join(voices, "es-2.mp3"), "utf8"),
        "original-es-2.mp3",
      );
      // Legacy per-voice previews and orphaned audition files are swept globally.
      const samplesDirectory = path.join(voices, "samples");
      const permanentFiles = (await fs.readdir(samplesDirectory)).filter(
        (name) => /-sample\.wav(?:\.json)?$/.test(name),
      );
      const permanent = new Map(
        await Promise.all(
          permanentFiles.map(
            async (name) =>
              [
                name,
                await fs.readFile(path.join(samplesDirectory, name)),
              ] as const,
          ),
        ),
      );
      const legacyId = "1b696cda-22c6-4c04-b358-3bd60aaf65cc";
      await fs.writeFile(
        path.join(
          samplesDirectory,
          `en-1-cosyvoice3-base-0.5b-preview-${legacyId}.wav`,
        ),
        "legacy temporary audio",
      );
      await fs.writeFile(
        path.join(samplesDirectory, "en-1-cosyvoice3-base-0.5b-preview.json"),
        JSON.stringify({
          voice: "en-1",
          voiceModel: "cosyvoice3-base-0.5b",
          previewId: legacyId,
          text: "Legacy audition",
          generatedAt: new Date().toISOString(),
        }),
      );
      await fs.writeFile(
        path.join(samplesDirectory, `es-1-latam-preview-${legacyId}.wav`),
        "orphaned audition",
      );
      const previewFiles = async () =>
        (await fs.readdir(samplesDirectory)).filter((name) =>
          name.includes("-preview"),
        );
      let previous: { voice: string; model: string; id: string } | undefined;
      for (const [voice, model] of [
        ["es-2", "multilingual-v3"],
        ["pt-1", "qwen3-base-0.6b"],
        ["pt-1", "qwen3-base-1.7b"],
        ["pt-1", "qwen3-base-1.7b"],
      ]) {
        const response = await request(
          voice,
          `Single global audition ${model}.`,
          model,
        );
        assert.equal(response.status, 202);
        const current = (await settled(voice, false)).samples.find(
          (sample: any) => sample.voiceModel === model,
        ).preview;
        assert.ok(current);
        assert.deepEqual(
          (await previewFiles()).sort(),
          [
            `${voice}-${model}-preview-${current.id}.wav`,
            `${voice}-${model}-preview.json`,
          ].sort(),
        );
        const all = await catalog();
        assert.equal(
          all
            .flatMap((voice) => voice.samples)
            .filter((sample: any) => sample.preview).length,
          1,
        );
        if (previous) {
          assert.equal(
            (
              await fetch(
                `${base}/${previous.voice}/sample?model=${previous.model}&preview=${previous.id}`,
                { headers },
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await fetch(`${base}/${previous.voice}/sample`, {
                method: "PUT",
                headers,
                body: JSON.stringify({
                  model: previous.model,
                  previewId: previous.id,
                }),
              })
            ).status,
            409,
          );
        }
        for (const [name, bytes] of permanent)
          assert.deepEqual(
            await fs.readFile(path.join(samplesDirectory, name)),
            bytes,
          );
        previous = { voice, model, id: current.id };
      }
      const latest = previous!;
      const savedGlobalPreview = await fetch(`${base}/${latest.voice}/sample`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ model: latest.model, previewId: latest.id }),
      });
      assert.equal(
        savedGlobalPreview.status,
        200,
        await savedGlobalPreview.text(),
      );
      assert.deepEqual(await previewFiles(), []);
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
