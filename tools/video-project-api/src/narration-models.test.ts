import { test } from "node:test";
import assert from "node:assert/strict";
import {
  narrationModelOptions,
  narrationModelForLocale,
} from "./narration-models";
test("every displayed language option resolves to the worker model, and V2 cannot be selected", () => {
  for (const locale of ["en", "es", "pt"] as const) {
    assert.equal(narrationModelOptions[locale].length, 2);
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
      `import fs from 'node:fs/promises'; import path from 'node:path'; const args=process.argv.slice(2); const output=args[args.indexOf('--output-dir')+1]; await fs.writeFile(path.join(output,'args.json'),JSON.stringify(args));`,
    );
    const script = `
      import assert from 'node:assert/strict'; import fs from 'node:fs/promises'; import path from 'node:path';
      import * as short from './src/engines/short/voice.ts'; import * as long from './src/engines/long/voice.ts';
      import { narrationModelOptions } from './src/narration-models.ts';
      import { narrationPresets } from './src/narration-parameters.ts';
      for(const [kind, engine] of Object.entries({short,long})) for(const locale of ['en','es','pt']) for(const {value} of narrationModelOptions[locale]) {
        const out=path.join(process.env.MODEL_TEST_DIR,kind+'-'+locale+'-'+value);
        await engine.generateVoice(out,{locale,voiceModel:value,voiceParameters:narrationPresets.expressive,reference:'John',version:'Bible',book:'John',start:'1:1',end:'1:2',passage_id:'john-1-1',templates:{intro:'Hello',outro:'Goodbye'}},true,'intro');
        const args=JSON.parse(await fs.readFile(path.join(out,'args.json'),'utf8'));
        for(const [key, parameter] of Object.entries(narrationPresets.expressive)) assert.equal(args[args.indexOf('--'+key.replaceAll('_','-'))+1],String(parameter));
        assert.equal(args[args.indexOf('--model')+1],value); assert.equal(args[args.indexOf('--language')+1],locale);
      }
    `;
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      VIDEO_TTS_SCRIPT: worker,
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
