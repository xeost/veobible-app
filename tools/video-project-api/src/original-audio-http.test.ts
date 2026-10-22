import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("audio comparison routes expose available originals and share alignment without writing to recordings", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "original-audio-http-"));
  try {
    const worker = path.join(root, "aligner.mjs");
    await fs.writeFile(
      worker,
      `import fs from 'node:fs/promises';
const arg = key => process.argv[process.argv.indexOf(key) + 1];
const request = JSON.parse(await fs.readFile(arg('--request'), 'utf8'));
if (!request.detectHeadings || request.language !== 'es') throw new Error('Original alignment mode required');
const chapter = request.chapters[0];
await fs.writeFile(arg('--output'), JSON.stringify({ model: 'fixture', chapters: [{ index: 0, segments: chapter.segments.map(segment => ({ id: segment.id, words: [{ text: segment.text, start: segment.start + .1, end: segment.end - .1 }] })) }] }));`,
    );
    const result = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "src/test-fixtures/original-audio-http.ts"],
      {
        cwd: new URL("../", import.meta.url),
        env: {
          ...process.env,
          WORKING_DIR: root,
          VIDEO_ALIGNER_PYTHON: process.execPath,
          VIDEO_ALIGNER_SCRIPT: worker,
        },
        timeout: 20000,
        maxBuffer: 1024 * 1024,
      },
    );
    assert.match(result.stdout, /ranged playback passed/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
