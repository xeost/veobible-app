import { test } from "node:test";
import assert from "node:assert/strict";
import {
  narrationModelOptions,
  narrationModelIdentity,
  narrationModelForLocale,
} from "./narration-models";
test("every displayed language option resolves to the worker model, and V2 cannot be selected", () => {
  for (const locale of ["en", "es", "pt"] as const) {
    assert.equal(narrationModelOptions[locale].length, locale === "pt" ? 4 : 6);
    for (const option of narrationModelOptions[locale])
      assert.equal(narrationModelForLocale(option.value, locale), option.value);
    assert.throws(() => narrationModelForLocale("multilingual-v2", locale));
  }
  assert.throws(() => narrationModelForLocale("chatterbox", "es"));
  assert.throws(() => narrationModelForLocale("latam", "pt"));
  assert.throws(() => narrationModelForLocale("pt-br", "en"));
});

test("both video engines pass the selected per-language model to the worker without changing the global provider", async () => {
  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "narration-models-"));
  try {
    const voices = path.join(root, "material", "voices");
    await fs.mkdir(voices, { recursive: true });
    for (const locale of ["es", "en", "pt"])
      await fs.writeFile(path.join(voices, `${locale}-1.mp3`), "sample");
    const worker = path.join(root, "worker.mjs");
    await fs.writeFile(
      worker,
      `import fs from 'node:fs/promises'; import path from 'node:path'; const args=process.argv.slice(2); const output=args[args.indexOf('--output-dir')+1]; await fs.writeFile(path.join(output,'args.json'),JSON.stringify(args)); await fs.copyFile(args[args.indexOf('--scripts')+1],path.join(output,'spoken-scripts.json'));`,
    );
    const script = `
      import assert from 'node:assert/strict'; import fs from 'node:fs/promises'; import path from 'node:path';
      import * as short from './src/engines/short/voice.ts'; import * as long from './src/engines/long/voice.ts';
      import { narrationModelOptions } from './src/narration-models.ts';
      import { narrationPresets } from './src/narration-parameters.ts';
      import { cosyDefaults } from './src/narration-model-settings.ts';
      for(const [kind, engine] of Object.entries({short,long})) for(const locale of ['en','es','pt']) for(const {value} of narrationModelOptions[locale]) for(const decoder of ((value.startsWith('qwen3-') || value.startsWith('cosyvoice3-')) ? [undefined] : ['general','v3'])) {
        const out=path.join(process.env.MODEL_TEST_DIR,kind+'-'+locale+'-'+value+'-'+decoder);
        await engine.generateVoice(out,{locale,voiceModel:value,voiceDecoder:decoder,voiceParameters:narrationPresets.expressive,voiceTextAdaptations:{reinforceSpanishRs:true},reference:'John',version:'Bible',book:'John',start:'1:1',end:'1:2',passage_id:'john-1-1',templates:{intro:'¶ ‹Rosa› corre ‹rápido.›',outro:'Goodbye'}},true,'intro');
        const spoken=JSON.parse(await fs.readFile(path.join(out,'spoken-scripts.json'),'utf8'));
        assert.equal(spoken.intro,locale==='es'?'Rrosa corrre rrápido.':'Rosa corre rápido.');
        const args=JSON.parse(await fs.readFile(path.join(out,'args.json'),'utf8'));
        for(const [key, parameter] of Object.entries(value.startsWith('cosyvoice3-') ? cosyDefaults : value.startsWith('qwen3-') ? {temperature:0.9,top_p:1,top_k:50,repetition_penalty:1.05,max_new_tokens:2048} : narrationPresets.expressive)) assert.equal(args[args.indexOf('--'+key.replaceAll('_','-'))+1],String(parameter));
        if(decoder) assert.equal(args[args.indexOf('--audio-decoder')+1],decoder); else assert.equal(args.includes('--audio-decoder'),false);
        assert.equal(args[args.indexOf('--model')+1],value); assert.equal(args[args.indexOf('--language')+1],locale);
      }
    `;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      VIDEO_TTS_SCRIPT: worker,
      VIDEO_QWEN_TTS_PYTHON: process.execPath,
      VIDEO_COSYVOICE_TTS_PYTHON: process.execPath,
      MODEL_TEST_DIR: root,
      WORKING_DIR: root,
    };
    for (const kind of ["SHORT", "LONG"]) {
      env[`VIDEO_${kind}_TTS_PROVIDER`] = "elevenlabs";
      env[`VIDEO_${kind}_TTS_PYTHON`] = process.execPath;
    }
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { cwd: new URL("../", import.meta.url), env, timeout: 15000 },
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("chapter cache depends only on the active model's preset configuration", async () => {
  const { chapterSynthesis } = await import("./pipeline.js");
  const { narrationPresets } = await import("./narration-parameters.js");
  const { qwenDefaults } = await import("./narration-model-settings.js");
  const parameters = {
    ...narrationPresets.natural,
    modelSettings: {
      "qwen3-base-0.6b": { ...qwenDefaults },
      "qwen3-base-1.7b": { ...qwenDefaults },
    },
  };
  const small = () =>
    chapterSynthesis("es", "qwen3-base-0.6b", parameters, "es-1");
  const chatterbox = () =>
    chapterSynthesis("es", "multilingual-v3", parameters, "es-1");
  const original = small(),
    originalChatterbox = chatterbox();
  parameters.modelSettings["qwen3-base-1.7b"].top_k = 20;
  assert.equal(small(), original);
  parameters.modelSettings["qwen3-base-0.6b"].top_k = 30;
  assert.notEqual(small(), original);
  assert.equal(chatterbox(), originalChatterbox);
  assert.notEqual(
    small(),
    chapterSynthesis("es", "qwen3-base-1.7b", parameters, "es-1"),
  );
});

test("voice providers inherit the shared Hugging Face cache without private overrides", async () => {
  const { narrationRuntime, qwenPython, cosyPython } =
    await import("./narration-runtime.js");
  for (const env of [
    {},
    { HF_HOME: "/shared/huggingface", HF_HUB_CACHE: "/shared/hub" },
  ]) {
    for (const model of [
      "multilingual-v3",
      "qwen3-base-0.6b",
      "qwen3-base-1.7b",
      "cosyvoice3-base-0.5b",
      "cosyvoice3-rl-0.5b",
    ]) {
      const runtime = narrationRuntime(model, "chatterbox-python", env);
      assert.equal(runtime.env, env);
      assert.equal(
        runtime.python,
        model.startsWith("cosyvoice3-")
          ? cosyPython
          : model.startsWith("qwen3-")
            ? qwenPython
            : "chatterbox-python",
      );
    }
  }
});

test("sample model identities distinguish every provider and model, including shared repositories", () => {
  const models = new Set(
    Object.values(narrationModelOptions)
      .flat()
      .map((option) => option.value),
  );
  const identities = [...models].map(narrationModelIdentity);
  assert.equal(
    new Set(
      identities.map((item) => `${item.voiceProvider}/${item.voiceModel}`),
    ).size,
    models.size,
  );
  for (const item of identities) {
    assert.ok(item.voiceModelName);
    assert.match(item.voiceModelRepository, /^[\w.-]+\/[\w.-]+$/);
  }
  const original = narrationModelIdentity("chatterbox");
  const multilingual = narrationModelIdentity("multilingual-v3");
  assert.equal(
    original.voiceModelRepository,
    multilingual.voiceModelRepository,
  );
  assert.notEqual(
    original.voiceModelCheckpoint,
    multilingual.voiceModelCheckpoint,
  );
});

test("CosyVoice variants are available only in English and Spanish with distinct checkpoints", () => {
  for (const model of ["cosyvoice3-base-0.5b", "cosyvoice3-rl-0.5b"] as const) {
    for (const locale of ["en", "es"] as const)
      assert.equal(narrationModelForLocale(model, locale), model);
    assert.throws(() => narrationModelForLocale(model, "pt"));
    const identity = narrationModelIdentity(model);
    assert.equal(identity.voiceProvider, "cosyvoice3");
    assert.equal(
      identity.voiceModelCheckpoint,
      model.includes("-rl-") ? "llm.rl.pt" : "llm.pt",
    );
  }
});

test("CosyVoice chapter caches isolate Base, RL and their active preset", async () => {
  const { chapterSynthesis } = await import("./pipeline.js");
  const { cosyDefaults } = await import("./narration-model-settings.js");
  const { narrationPresets } = await import("./narration-parameters.js");
  const parameters = {
    ...narrationPresets.natural,
    modelSettings: {
      "cosyvoice3-base-0.5b": { ...cosyDefaults },
      "cosyvoice3-rl-0.5b": { ...cosyDefaults },
    },
  };
  const hash = () =>
    chapterSynthesis("es", "cosyvoice3-base-0.5b", parameters, "es-1");
  const original = hash();
  parameters.modelSettings["cosyvoice3-rl-0.5b"].speed = 0.8;
  assert.equal(hash(), original);
  parameters.modelSettings["cosyvoice3-base-0.5b"].speed = 1.1;
  assert.notEqual(hash(), original);
  assert.notEqual(
    hash(),
    chapterSynthesis("es", "cosyvoice3-rl-0.5b", parameters, "es-1"),
  );
});
