import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("both engines use permanent shared numbered samples for every language and narration", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shared-base-voices-"));
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        `
      import assert from 'node:assert/strict';
      import fs from 'node:fs/promises';
      import path from 'node:path';
      import * as short from './src/engines/short/voice.ts';
      import * as long from './src/engines/long/voice.ts';
      const directory = path.join(process.env.WORKING_DIR, 'material', 'voices');
      await fs.mkdir(directory, {recursive: true});
      for (const locale of ['es', 'en', 'pt']) {
        const sample = path.join(directory, locale + '-1.mp3');
        await fs.writeFile(sample, 'original-' + locale);
        // Legacy dedicated files must never change the selected reference.
        await fs.writeFile(path.join(directory, locale + '-intro.mp3'), 'legacy');
        await fs.writeFile(path.join(directory, locale + '-outro.wav'), 'legacy');
        for (const engine of [short, long]) {
          assert.deepEqual(await engine.resolveVoicePrompts(locale), {intro: sample, outro: sample});
          assert.deepEqual(await engine.resolveVoicePrompts(locale, ['intro']), {intro: sample, outro: null});
          assert.deepEqual(await engine.resolveVoicePrompts(locale, ['outro']), {intro: null, outro: sample});
        }
        await fs.writeFile(path.join(directory, locale + '-2.mp3'), 'alternative');
        await fs.writeFile(path.join(directory, locale + '-3.mp3'), 'alternative');
        for (const engine of [short, long])
          assert.deepEqual(await engine.resolveVoicePrompts(locale), {intro: sample, outro: sample});
        for (const engine of [short, long]) {
          const alternate = path.join(directory, locale + '-2.mp3');
          assert.deepEqual(await engine.resolveVoicePrompts(locale, ['intro', 'outro'], locale + '-2'), {intro: alternate, outro: alternate});
          await assert.rejects(engine.resolveVoicePrompts(locale, ['intro'], '../escape'), /Invalid/);
          await assert.rejects(engine.resolveVoicePrompts(locale, ['intro'], (locale === 'en' ? 'es' : 'en') + '-1'), /language mismatch/);
        }
        assert.equal(await fs.readFile(sample, 'utf8'), 'original-' + locale);
        // A missing default must fail, even if alternatives and legacy files exist.
        await fs.unlink(sample);
        for (const engine of [short, long])
          await assert.rejects(engine.resolveVoicePrompts(locale), /Base voice sample does not exist/);
        await fs.mkdir(sample);
        for (const engine of [short, long])
          await assert.rejects(engine.resolveVoicePrompts(locale), /Base voice sample does not exist/);
      }
      console.log('shared base voices passed');
      `,
      ],
      {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          WORKING_DIR: root,
          // Former configuration must not bypass the shared sample library.
          VIDEO_SHORT_TTS_VOICE_PROMPT_ES: "/obsolete/short.mp3",
          VIDEO_LONG_TTS_VOICE_PROMPT_ES_INTRO: "/obsolete/intro.mp3",
        },
      },
    );
    assert.match(stdout, /shared base voices passed/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
