import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadLocalModels } from "./local-models.js";
import { localModelsSchema } from "./local-models-contract.js";
import { alignmentWorkerRoot } from "./alignment-config.js";
const execute = promisify(execFile);
const voiceScript = fileURLToPath(
  new URL("../../voice-generator/cli.py", import.meta.url),
);
const voice = (overrides = {}) => ({
  ttsProvider: "chatterbox",
  ttsPython: "voice-python",
  ttsScript: voiceScript,
  ttsModels: { es: "multilingual", en: "multilingual", pt: "multilingual" },
  ...overrides,
});
const alignment = {
  python: "alignment-python",
  script: path.join(alignmentWorkerRoot, "cli.py"),
  model: "mlx-community/Qwen3-ForcedAligner-0.6B-8bit",
  asrModel: "mlx-community/Qwen3-ASR-0.6B-8bit",
};
const revision = "a".repeat(40);

test("inventory groups shared models and probes each interpreter/cache/software environment once", async () => {
  const calls: Array<{ python: string; request: any; env: NodeJS.ProcessEnv }> =
    [];
  const result = await loadLocalModels({
    voices: { short: voice(), long: voice() },
    alignment,
    env: {},
    probe: async (python, request, env) => {
      calls.push({ python, request, env });
      return {
        version: request.package === "chatterbox-tts" ? "0.1.7" : "0.3.1",
        models: request.models.map(() => ({ status: "downloaded", revision })),
      };
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(result.models.length, 8);
  const narration = result.models.find((model) => model.role === "voice")!;
  assert.deepEqual(narration.uses, [
    { kind: "short", languages: ["es", "en", "pt"] },
    { kind: "long", languages: ["es", "en", "pt"] },
  ]);
  assert.equal(narration.variant, "chatterbox-v3");
  assert.equal(narration.revision, revision);
  assert.equal(narration.software.version, "0.1.7");
  assert.equal(
    result.models.find((model) => model.role === "alignment")?.software.version,
    "0.3.1",
  );
  assert.equal(
    calls.find((call) => call.python === "alignment-python")?.env.HF_HOME,
    undefined,
  );
  assert.ok(!JSON.stringify(result).includes(voiceScript));
  assert.ok(localModelsSchema.safeParse(result).success);
});

test("Latam includes its base components, preserves language overrides and uses separate software versions with a shared interpreter/cache", async () => {
  const requests: any[] = [];
  const config = voice({
    ttsPython: "same-python",
    ttsModels: { es: "latam", en: "multilingual", pt: "multilingual" },
  });
  const result = await loadLocalModels({
    voices: { short: config, long: voice({ ttsProvider: "elevenlabs" }) },
    alignment: { ...alignment, python: "same-python" },
    env: { HF_HOME: "/custom/cache" },
    probe: async (_python, request, env) => {
      assert.equal(env.HF_HOME, "/custom/cache");
      assert.equal(env.HF_HUB_CACHE, undefined);
      requests.push(request);
      return {
        version: request.package,
        models: request.models.map(() => ({
          status: "not_downloaded",
          revision: null,
        })),
      };
    },
  });
  assert.equal(requests.length, 3);
  assert.equal(
    result.models.filter((model) => model.role === "voice").length,
    6,
  );
  const base = requests
    .find((request) => request.package === "chatterbox-tts")
    .models.find((model: any) => model.repository === "ResembleAI/chatterbox");
  assert.ok(base.required.includes("t3_mtl23ls_v3.safetensors"));
  assert.deepEqual(
    result.models.find((model) => model.name.includes("Latam"))?.uses,
    [{ kind: "short", languages: ["es"] }],
  );
  assert.equal(
    result.models.find((model) => model.role === "alignment")?.software.version,
    "mlx-audio",
  );
});

test("one unavailable environment does not hide others, and custom workers never claim known model revisions", async () => {
  const result = await loadLocalModels({
    voices: {
      short: voice(),
      long: voice({ ttsScript: "/custom/narration.py" }),
    },
    alignment,
    env: {},
    probe: async (python, request) => {
      if (python === "voice-python") throw new Error("Interpreter unavailable");
      return {
        version: "0.3.1",
        models: request.models.map(() => ({ status: "downloaded", revision })),
      };
    },
  });
  assert.equal(
    result.models.find((model) => model.name === "Chatterbox Multilingual")
      ?.status,
    "unavailable",
  );
  const custom = result.models.find(
    (model) => model.name === "Custom narration model",
  )!;
  assert.equal(custom.status, "custom");
  assert.equal(custom.revision, null);
  assert.equal(custom.repository, null);
  assert.equal(
    result.models.find((model) => model.role === "alignment")?.revision,
    revision,
  );
  assert.ok(!JSON.stringify(result).includes("/custom/"));
});

test("read-only Python probe reports the actual main revision, missing downloads, incomplete snapshots and local directories", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "local-models-"));
  try {
    const cache = path.join(root, "hub");
    const folder = path.join(cache, "models--test--model");
    const snapshot = path.join(folder, "snapshots", revision);
    await fs.mkdir(path.join(folder, "refs"), { recursive: true });
    await fs.mkdir(snapshot, { recursive: true });
    await fs.writeFile(path.join(folder, "refs/main"), revision);
    await fs.writeFile(path.join(snapshot, "config.json"), "{}");
    const newer = path.join(folder, "snapshots", "b".repeat(40));
    await fs.mkdir(newer);
    const inspect = async () => {
      const { stdout } = await execute(
        "python3",
        [
          "-B",
          fileURLToPath(new URL("./local-model-inventory.py", import.meta.url)),
          JSON.stringify({
            package: "nonexistent-test-package-731",
            models: [
              {
                repository: "test/model",
                required: ["config.json", "*.safetensors"],
              },
              { repository: "test/missing", required: ["config.json"] },
              { repository: null, localPath: root, required: [] },
            ],
          }),
        ],
        {
          env: {
            ...process.env,
            HF_HUB_CACHE: cache,
            HF_HUB_OFFLINE: "1",
            HF_HUB_DISABLE_TELEMETRY: "1",
          },
        },
      );
      return JSON.parse(stdout);
    };
    let result = await inspect();
    assert.equal(result.version, null);
    assert.deepEqual(result.models, [
      { status: "incomplete", revision },
      { status: "not_downloaded", revision: null },
      { status: "local", revision: null },
    ]);
    const blob = path.join(root, "weights");
    await fs.writeFile(blob, "weights");
    await fs.symlink(blob, path.join(snapshot, "weights.safetensors"));
    result = await inspect();
    assert.deepEqual(result.models[0], { status: "downloaded", revision });
    assert.equal(
      await fs.readFile(path.join(folder, "refs/main"), "utf8"),
      revision,
    );
    await fs.writeFile(path.join(folder, "refs/main"), "../../outside");
    assert.deepEqual((await inspect()).models[0], {
      status: "unavailable",
      revision: null,
    });
    await fs.unlink(path.join(folder, "refs/main"));
    assert.deepEqual((await inspect()).models[0], {
      status: "not_downloaded",
      revision: null,
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("inventory keeps explicitly configured V2 and default V3 separate", async () => {
  const requests: any[] = [];
  const result = await loadLocalModels({
    voices: {
      short: voice(),
      long: voice({
        ttsModels: {
          es: "multilingual-v2",
          en: "multilingual-v2",
          pt: "multilingual-v2",
        },
      }),
    },
    alignment,
    env: {},
    probe: async (_python, request) => {
      requests.push(request);
      return {
        version: "0.1.7",
        models: request.models.map(() => ({ status: "downloaded", revision })),
      };
    },
  });
  const models = result.models.filter(
    (model) => model.role === "voice" && model.uses.length > 0,
  );
  assert.deepEqual(
    models.map((model) => model.variant),
    ["chatterbox-v3", "chatterbox-v2"],
  );
  assert.deepEqual(
    models.map((model) => model.uses.map((use) => use.kind)),
    [["short"], ["long"]],
  );
  const probeModels = requests.find(
    (request) => request.package === "chatterbox-tts",
  ).models;
  assert.ok(probeModels[0].required.includes("t3_mtl23ls_v3.safetensors"));
  assert.ok(!probeModels[0].required.includes("t3_mtl23ls_v2.safetensors"));
  assert.ok(probeModels[1].required.includes("t3_mtl23ls_v2.safetensors"));
});

test("catalogue includes all requested alternatives without selecting or loading them, even with another provider active", async () => {
  const calls: any[] = [];
  const result = await loadLocalModels({
    voices: {
      short: voice({ ttsProvider: "elevenlabs" }),
      long: voice({ ttsProvider: "elevenlabs" }),
    },
    alignment,
    env: {},
    probe: async (_python, request) => {
      calls.push(request);
      return {
        version: "0.1.7",
        models: request.models.map(() => ({
          status: "not_downloaded",
          revision: null,
        })),
      };
    },
  });
  const alternatives = result.models.filter((model) => model.role === "voice");
  assert.deepEqual(
    alternatives.map((model) => [model.name, model.variant, model.repository]),
    [
      ["Chatterbox Multilingual", "chatterbox-v3", "ResembleAI/chatterbox"],
      ["Chatterbox", "chatterbox-original", "ResembleAI/chatterbox"],
      [
        "Chatterbox Multilingual pt-BR",
        "chatterbox-pt-br",
        "ResembleAI/Chatterbox-Multilingual-pt-br",
      ],
      [
        "Chatterbox es-MX Latam",
        "chatterbox-latam",
        "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
      ],
      [
        "Qwen3-TTS Base 0.6B",
        "qwen3-base-0.6b",
        "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
      ],
      [
        "Qwen3-TTS Base 1.7B",
        "qwen3-base-1.7b",
        "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
      ],
    ],
  );
  assert.ok(
    alternatives.every(
      (model) => model.uses.length === 0 && model.status === "not_downloaded",
    ),
  );
  assert.equal(calls.length, 3);
  const probes = calls.find(
    (request) => request.package === "chatterbox-tts",
  ).models;
  assert.ok(probes[1].required.includes("t3_cfg.safetensors"));
  assert.ok(
    !probes[1].required.some((name: string) => name.includes("mtl23ls")),
  );
  assert.ok(probes[2].required.includes("t3_pt_br.safetensors"));
  assert.ok(probes[2].required.includes("s3gen_v3.pt"));
  assert.ok(localModelsSchema.safeParse(result).success);
});
