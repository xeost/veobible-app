import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  disabledModels,
  setModelEnabled,
  assertNarrationModelEnabled,
} from "./local-model-state.js";
import { hfCacheRemovalArguments } from "./local-model-removal.js";
import {
  localModelSchema,
  localModelRemovalTargets,
} from "./local-models-contract.js";
import { removeLocalModel } from "./local-models.js";
const model = (repository: string, variant: string) =>
  localModelSchema.parse({
    id: "local-model-1",
    name: variant,
    role: "voice",
    uses: [],
    repository,
    revision: null,
    status: "downloaded",
    variant,
    software: { name: "cosyvoice", version: null },
  });

test("full cache removal uses the shared cache and passes the repository without a shell", () => {
  assert.deepEqual(
    hfCacheRemovalArguments("FunAudioLLM/Fun-CosyVoice3-0.5B-2512"),
    ["cache", "rm", "model/FunAudioLLM/Fun-CosyVoice3-0.5B-2512", "--yes"],
  );
  assert.throws(() => hfCacheRemovalArguments("../model"));
  assert.throws(() => hfCacheRemovalArguments("test/model;echo unsafe"));
});

test("removal identifies all shared variants and dependent regional voices", () => {
  const items = [
    model("ResembleAI/chatterbox", "chatterbox-original"),
    model("ResembleAI/chatterbox", "chatterbox-v3"),
    model("ResembleAI/Chatterbox-Multilingual-es-mx-latam", "chatterbox-latam"),
    model("ResembleAI/Chatterbox-Multilingual-pt-br", "chatterbox-pt-br"),
    model("Qwen/Qwen3-TTS-12Hz-0.6B-Base", "qwen3-base-0.6b"),
  ];
  assert.equal(
    localModelRemovalTargets(items, "ResembleAI/chatterbox").length,
    4,
  );
  assert.equal(
    localModelRemovalTargets(
      items,
      "ResembleAI/Chatterbox-Multilingual-es-mx-latam",
    ).length,
    1,
  );
});

test("hf removal deletes the entire repository and disables both CosyVoice variants", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hf-model-removal-"));
  const previous = process.env.WORKING_DIR;
  process.env.WORKING_DIR = root;
  try {
    const repository = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512";
    const folder = path.join(
      root,
      "hub",
      "models--FunAudioLLM--Fun-CosyVoice3-0.5B-2512",
    );
    await fs.mkdir(path.join(folder, "snapshots", "a".repeat(40)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(folder, "unused-old-weights"),
      "orphaned weights",
    );
    const unrelated = path.join(root, "hub", "models--test--unrelated");
    await fs.mkdir(unrelated);
    const bin = path.join(root, "bin");
    await fs.mkdir(bin);
    await fs.writeFile(
      path.join(bin, "hf"),
      `#!${process.execPath}
const fs = require("node:fs"), path = require("node:path");
const args = process.argv.slice(2);
fs.writeFileSync(path.join(process.env.WORKING_DIR, "hf-args.json"), JSON.stringify(args));
fs.rmSync(path.join(process.env.HF_HUB_CACHE, "models--" + args[2].slice(6).replaceAll("/", "--")), { recursive: true, force: true });
`,
    );
    await fs.chmod(path.join(bin, "hf"), 0o755);
    const result = await removeLocalModel(
      model(repository, "cosyvoice3-base-0.5b"),
      {
        env: {
          ...process.env,
          HF_HUB_CACHE: path.join(root, "hub"),
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        },
        probe: async (_, request) => ({
          version: null,
          models: request.models.map((item) => ({
            status:
              item.repository === repository ? "not_downloaded" : "downloaded",
            revision: null,
          })),
        }),
      },
    );
    await assert.rejects(fs.stat(folder), { code: "ENOENT" });
    assert.ok((await fs.stat(unrelated)).isDirectory());
    assert.deepEqual(
      JSON.parse(await fs.readFile(path.join(root, "hf-args.json"), "utf8")),
      hfCacheRemovalArguments(repository),
    );
    assert.ok(disabledModels().includes(`${repository}:cosyvoice3-base-0.5b`));
    assert.ok(disabledModels().includes(`${repository}:cosyvoice3-rl-0.5b`));
    assert.ok(
      result.models
        .filter((item) => item.repository === repository)
        .every(
          (item) => item.enabled === false && item.status === "not_downloaded",
        ),
    );
  } finally {
    if (previous === undefined) delete process.env.WORKING_DIR;
    else process.env.WORKING_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("disabled models persist and block automatic downloads until explicitly enabled", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "disabled-model-"));
  const previous = process.env.WORKING_DIR;
  process.env.WORKING_DIR = root;
  try {
    const model = {
      repository: "ResembleAI/chatterbox",
      variant: "chatterbox-original",
    };
    setModelEnabled(model, false);
    assert.deepEqual(disabledModels(), [
      "ResembleAI/chatterbox:chatterbox-original",
    ]);
    assert.throws(() => assertNarrationModelEnabled("chatterbox"), /disabled/);
    assert.doesNotThrow(() => assertNarrationModelEnabled("multilingual-v3"));
    setModelEnabled(model, true);
    assert.deepEqual(disabledModels(), []);
    assert.doesNotThrow(() => assertNarrationModelEnabled("chatterbox"));
  } finally {
    if (previous === undefined) delete process.env.WORKING_DIR;
    else process.env.WORKING_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});
