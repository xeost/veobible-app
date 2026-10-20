import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { alignGeneratedSpeech } from "./forced-alignment.js";

test("generated speech uses the exact transcript and rejects incomplete or invalid word timings", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-alignment-"),
  );
  const previous = {
    python: process.env.VIDEO_ALIGNER_PYTHON,
    script: process.env.VIDEO_ALIGNER_SCRIPT,
  };
  try {
    const worker = path.join(directory, "worker.mjs");
    await fs.writeFile(
      worker,
      `import fs from 'node:fs/promises';
const arg = key => process.argv[process.argv.indexOf(key) + 1];
const request = JSON.parse(await fs.readFile(arg('--request'), 'utf8'));
if (request.detectHeadings !== false || request.language !== 'en') throw new Error('Wrong transcript mode');
const chapter = request.chapters[0];
if (chapter.segments[0].text !== 'First verse.' || chapter.segments[1].text !== 'Second verse.') throw new Error('Wrong transcript');
let segments = chapter.segments.map((segment, index) => ({id: segment.id, words: [
  {text: segment.text, start: index * 2 + 0.4, end: index * 2 + 1.6}
]}));
if (chapter.audio === 'missing') segments.pop();
if (chapter.audio === 'duplicate') segments[1].id = segments[0].id;
if (chapter.audio === 'overflow') segments[1].words[0].end = 10;
if (chapter.audio === 'overlap') segments[1].words[0].start = 0.5;
if (chapter.audio === 'reversed') segments[1].words[0].end = 2;
await fs.writeFile(arg('--output'), JSON.stringify({model: 'fixture', chapters: [{index: 0, segments}]}));`,
    );
    process.env.VIDEO_ALIGNER_PYTHON = process.execPath;
    process.env.VIDEO_ALIGNER_SCRIPT = worker;
    const segments = [
      { id: "one", text: "First verse.", start: 0, end: 2 },
      { id: "two", text: "Second verse.", start: 2, end: 4 },
    ];
    const align = (audio: string) =>
      alignGeneratedSpeech(audio, 4, "en", segments, "ffmpeg", () => {});
    const { cues, model } = await align("valid");
    assert.equal(model, "fixture");
    assert.equal(cues[0].reference, "one");
    assert.equal(cues[1].text, "Second verse.");
    assert.ok(Math.abs(cues[0].start - 0.37) < 1e-6);
    assert.ok(Math.abs(cues[1].end - 3.65) < 1e-6);
    for (const invalid of [
      "missing",
      "duplicate",
      "overflow",
      "overlap",
      "reversed",
    ])
      await assert.rejects(align(invalid), /alignment/);
  } finally {
    if (previous.python === undefined) delete process.env.VIDEO_ALIGNER_PYTHON;
    else process.env.VIDEO_ALIGNER_PYTHON = previous.python;
    if (previous.script === undefined) delete process.env.VIDEO_ALIGNER_SCRIPT;
    else process.env.VIDEO_ALIGNER_SCRIPT = previous.script;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
