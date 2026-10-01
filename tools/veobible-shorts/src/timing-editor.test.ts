import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { editPassageTimings, type TimingEditorUI } from "./timing-editor.js";
import { applyPassageAudioOffsets, type Passage } from "./shorts.js";
import { moveVerseBoundary, offsetsFromCues } from "./timing-model.js";
import { applyVerseOffsets } from "./verse-timing.js";

test("moving either side of a verse join updates both neighbors without changing other boundaries", () => {
  const cues = [
    { reference: "John 1:1", text: "one", start: 0, end: 2 },
    { reference: "John 1:2", text: "two", start: 2, end: 4 },
    { reference: "John 1:3", text: "three", start: 4, end: 6 }
  ];
  const earlier = moveVerseBoundary(cues, 1, "start", 1.85, 6);
  assert.equal(earlier[0].end, 1.85);
  assert.equal(earlier[1].start, 1.85);
  assert.equal(earlier[1].end, 4);
  assert.deepEqual(earlier[2], cues[2]);
  assert.equal(cues[0].end, 2, "Input remains unchanged");
  const later = moveVerseBoundary(cues, 1, "end", 4.25, 6);
  assert.equal(later[1].end, 4.25);
  assert.equal(later[2].start, 4.25);
  assert.equal(later[0].end, 2);
  assert.deepEqual(offsetsFromCues(cues, later).map(row => [row.startOffsetSeconds, row.endOffsetSeconds]), [[0, 0], [0, 0.25], [0.25, 0]]);
  assert.equal(moveVerseBoundary(cues, 0, "start", 0.1, 6)[1].start, 2);
  assert.equal(moveVerseBoundary(cues, 2, "end", 5.9, 6)[1].end, 4);
  for (const [index, edge, time] of [[1, "start", -0.1], [1, "end", 7], [0, "end", 4], [2, "start", 6]] as const) {
    assert.throws(() => moveVerseBoundary(cues, index, edge, time, 6), /positive duration/);
  }
});

test("passage offsets only change the first and last cuts, including multiple chapters", () => {
  const sections = [{ file: "one", start: 1, end: 8 }, { file: "two", start: 0, end: 4 }];
  assert.deepEqual(applyPassageAudioOffsets(sections, [8, 10], { startSeconds: -0.25, endSeconds: 0.2 }), [
    { file: "one", start: 0.75, end: 8 }, { file: "two", start: 0, end: 4.2 }
  ]);
  assert.equal(sections[0].start, 1);
  assert.throws(() => applyPassageAudioOffsets(sections, [8, 10], { startSeconds: -2, endSeconds: 0 }), /invalid audio cut/);
});

test("timing editor loads JSON, previews exact cuts and coupled verse edits, and only returns memory state", { timeout: 30000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-editor-test-"));
  const original = { outputDir: config.outputDir, bibleDataDir: config.bibleDataDir, audioDir: config.audioDir };
  const version = config.versions[0];
  const passage: Passage = { id: "john-1-2-3", book: "john", start: { chapter: 1, verse: 2 }, end: { chapter: 1, verse: 3 } };
  try {
    Object.assign(config, { outputDir: path.join(root, "outputs"), bibleDataDir: path.join(root, "bible"), audioDir: path.join(root, "audio") });
    const data = path.join(config.bibleDataDir, version.locale, version.id);
    const audio = path.join(config.audioDir, version.id);
    const internal = path.join(config.outputDir, version.id, passage.id, "_internal");
    await fs.mkdir(path.join(data, "john"), { recursive: true });
    await fs.mkdir(audio, { recursive: true });
    await fs.mkdir(internal, { recursive: true });
    await fs.writeFile(path.join(data, "index.json"), JSON.stringify({ metadata: { name: "Test Bible" }, books: [{ id: "john", name: "John", chapters: 1, versesPerChapter: [4] }] }));
    await fs.writeFile(path.join(data, "john", "1.json"), JSON.stringify([1, 2, 3, 4].map(verse => ({ verse, text: `Verse ${verse}` }))));
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=500:duration=4", "-y", path.join(audio, "01-john-1.mp3")]);
    const audioFile = path.join(internal, "2-passage-audio-offsets.json");
    const verseFile = path.join(internal, "2-verse-text-offsets.json");
    const audioText = '{"startSeconds":0.05,"endSeconds":-0.05}\n';
    const verseText = JSON.stringify({ verses: [
      { reference: "John 1:2", startOffsetSeconds: 0, endOffsetSeconds: -0.02 },
      { reference: "John 1:3", startOffsetSeconds: -0.02, endOffsetSeconds: 0 }
    ] });
    await fs.writeFile(audioFile, audioText);
    await fs.writeFile(verseFile, verseText);
    const actions = ["play", "set-start", "set-end", "play-start", "verses", "play-all", "set-end", "select", "1", "set-start", "play-verse", "use"];
    const numbers = [0.1, -0.1, 0.08, 0.05, 0.2];
    const previews: Array<{ duration: number; cues?: Array<{ start: number; end: number }> }> = [];
    let prompts = 0;
    const ui: TimingEditorUI = {
      choose: async (message, choices) => {
        if (!prompts++) assert.ok(message.includes("Start offset +0.050 s"), "Existing audio JSON initializes the editor");
        const action = actions.shift();
        assert.ok(action && choices.some(choice => choice.value === action), `Unexpected editor action ${action}`);
        return action;
      },
      number: async () => { const value = numbers.shift(); assert.notEqual(value, undefined); return value!; },
      play: async (file, options) => {
        const seconds = Number(execFileSync(config.ffprobeBin, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" }));
        assert.ok(Math.abs(seconds - options.duration) < 0.003, `${seconds} vs ${options.duration}`);
        previews.push({ duration: seconds, cues: options.cues?.map(cue => ({ start: cue.start, end: cue.end })) });
        return "done";
      }
    };
    const result = await editPassageTimings(version, passage, undefined, ui);
    assert.ok(result);
    assert.deepEqual(result.passageOffsets, { startSeconds: 0.1, endSeconds: -0.1 });
    assert.equal(result.verseOffsets[0].endOffsetSeconds, 0.05);
    assert.equal(result.verseOffsets[1].startOffsetSeconds, 0.05);
    assert.equal(previews.length, 4);
    assert.ok(Math.abs(previews[0].duration - previews[1].duration - 0.1) < 0.003);
    assert.equal(previews[2].cues![0].end, previews[2].cues![1].start);
    assert.equal(previews[3].cues![0].end, previews[3].cues![1].start);
    assert.equal(await fs.readFile(audioFile, "utf8"), audioText, "No JSON is written by the editor");
    assert.equal(await fs.readFile(verseFile, "utf8"), verseText);
    const saved = structuredClone(result);
    const cancelActions = ["set-start", "cancel"];
    assert.equal(await editPassageTimings(version, passage, result, { ...ui, choose: async message => {
      assert.ok(message.includes("Start offset +0.100 s") || message.includes("Start offset +0.200 s"));
      return cancelActions.shift()!;
    } }), undefined);
    assert.deepEqual(result, saved, "Cancelled edits leave the previous session intact");
    const newPassage = { ...passage, id: "john-1-2-3-new" };
    const newActions = ["verses", "use"];
    const fresh = await editPassageTimings(version, newPassage, undefined, { ...ui, choose: async (_message, choices) => {
      const action = newActions.shift()!;
      assert.ok(choices.some(choice => choice.value === action));
      return action;
    } });
    assert.deepEqual(fresh?.passageOffsets, { startSeconds: 0, endSeconds: 0 });
    assert.ok(fresh?.verseOffsets.every(row => row.startOffsetSeconds === 0 && row.endOffsetSeconds === 0));
    await assert.rejects(fs.access(path.join(config.outputDir, version.id, newPassage.id)), "Editor does not create an output folder before rendering");
    const initialCues = [{ reference: "John 1:2", text: "Verse 2", start: 0, end: 0.9 }, { reference: "John 1:3", text: "Verse 3", start: 0.9, end: 1.8 }];
    const applied = await applyVerseOffsets(path.dirname(internal), true, initialCues, result.verseOffsets);
    assert.ok(Math.abs(applied.cues[0].end - 0.95) < 1e-9);
    assert.ok(Math.abs(applied.cues[1].start - 0.95) < 1e-9);
  } finally {
    Object.assign(config, original);
    await fs.rm(root, { recursive: true, force: true });
  }
});
