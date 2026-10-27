import { test } from "node:test";
import assert from "node:assert/strict";
import { localModelSchema } from "./local-models-contract.js";
import {
  localModelDownloadPlan,
  type ModelDownloadSource,
} from "./local-models.js";
import {
  hfDownloadArguments,
  LocalModelDownloads,
} from "./local-model-downloads.js";
const model = (
  variant = "cosyvoice3-base-0.5b",
  repository = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512",
) =>
  localModelSchema.parse({
    id: "local-model-1",
    name: "Test",
    role: "voice",
    uses: [],
    repository,
    revision: null,
    status: "not_downloaded",
    enabled: false,
    variant,
    software: { name: "cosyvoice", version: null },
  });
const source: ModelDownloadSource = {
  repository: "test/model",
  patterns: ["config.json", "*.safetensors"],
  required: ["config.json", "*.safetensors"],
  python: "python3",
  env: {},
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("download plans select one variant and include shared voice and tokenizer dependencies", async () => {
  const base = await localModelDownloadPlan(model());
  assert.ok(base[0].patterns.includes("llm.pt"));
  assert.ok(!base[0].patterns.includes("llm.rl.pt"));
  assert.ok(
    base[0].required.includes("CosyVoice-BlankEN/generation_config.json"),
  );
  const rl = await localModelDownloadPlan(model("cosyvoice3-rl-0.5b"));
  assert.ok(rl[0].patterns.includes("llm.rl.pt"));
  assert.ok(!rl[0].patterns.includes("llm.pt"));
  const regional = await localModelDownloadPlan(
    model("chatterbox-latam", "ResembleAI/Chatterbox-Multilingual-es-mx-latam"),
  );
  assert.equal(regional.length, 2);
  assert.equal(regional[0].repository, "ResembleAI/chatterbox");
  assert.ok(regional[0].required.includes("ve.pt"));
  assert.ok(regional[1].patterns.includes("t3_es_mx_latam.safetensors"));
  assert.ok(!regional[0].patterns.some((pattern) => pattern.includes("t3_")));
  const qwen = await localModelDownloadPlan(
    model("qwen3-base-0.6b", "Qwen/Qwen3-TTS-12Hz-0.6B-Base"),
  );
  assert.ok(qwen[0].patterns.includes("speech_tokenizer/*"));
  await assert.rejects(
    localModelDownloadPlan(model("custom", "test/custom")),
    /Unsupported/,
  );
});

test("hf arguments reuse the standard shared cache and request only approved patterns", () => {
  const args = hfDownloadArguments(source);
  assert.deepEqual(args, [
    "download",
    "test/model",
    "--revision",
    "main",
    "--max-workers",
    "2",
    "--include",
    "config.json",
    "--include",
    "*.safetensors",
  ]);
  assert.ok(!args.includes("--cache-dir"));
  assert.ok(!args.includes("--local-dir"));
  assert.ok(!args.includes("--force-download"));
});

test("background download deduplicates requests, verifies files and only then enables the model", async () => {
  let finish!: () => void;
  const running = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let verified!: () => void;
  const verifying = new Promise<void>((resolve) => {
    verified = resolve;
  });
  const enabled: boolean[] = [];
  let changed = 0;
  const downloads = new LocalModelDownloads({
    run: async () => running,
    verify: async () => verifying,
    enable: (_, value) => {
      enabled.push(value);
    },
    changed: () => {
      changed++;
    },
  });
  const item = model();
  const job = downloads.start(item, [source]);
  assert.equal(downloads.start(item, [source]), job);
  assert.throws(
    () => downloads.start(model("cosyvoice3-rl-0.5b"), [source]),
    /in progress/,
  );
  assert.equal(job.status, "downloading");
  assert.deepEqual(enabled, []);
  finish();
  await tick();
  assert.equal(job.status, "verifying");
  assert.ok(downloads.busy);
  assert.deepEqual(enabled, []);
  verified();
  await tick();
  assert.equal(job.status, "completed");
  assert.ok(job.finishedAt);
  assert.deepEqual(enabled, [true]);
  assert.equal(changed, 1);
  assert.equal(downloads.busy, false);
  assert.equal(
    downloads.withState({ checkedAt: new Date().toISOString(), models: [item] })
      .models[0].download?.status,
    "completed",
  );
});

test("failed or incomplete downloads stay disabled and can be retried", async () => {
  let attempts = 0;
  let enables = 0;
  const downloads = new LocalModelDownloads({
    run: async () => {
      attempts++;
    },
    verify: async () => {
      if (attempts === 1) throw new Error("Missing weights");
    },
    enable: () => {
      enables++;
    },
  });
  const item = model();
  downloads.start(item, [source]);
  await tick();
  assert.equal(downloads.state(item)?.status, "failed");
  assert.equal(enables, 0);
  downloads.start(item, [source]);
  await tick();
  assert.equal(downloads.state(item)?.status, "completed");
  assert.equal(enables, 1);
  downloads.clear(item);
  assert.equal(downloads.state(item), undefined);
});
