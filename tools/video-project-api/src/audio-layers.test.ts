import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioLayerSegments,
  audioLayerText,
  orderedAudioLayers,
} from "./audio-layers.js";
import {
  audioGenerateSchema,
  audioRecordingSchema,
  type AudioLayer,
  type AudioRecording,
} from "./audio-project-schema.js";
const base = {
  file: "jude/base/verse.wav",
  duration: 10,
  revision: "base",
  text: "0123456789",
};
const layer = (
  revision: string,
  start: number,
  end: number,
  duration: number,
  text: string,
): AudioLayer => ({
  file: `jude/${revision}/phrase.wav`,
  revision,
  enabled: true,
  start,
  end,
  duration,
  textStart: start,
  textEnd: end,
  text,
});
const first = layer("first", 2, 7, 10, "ABCDE");
const last = layer("last", 5, 9, 4, "WXYZ");
const recording: AudioRecording = { ...base, base, layers: [first, last] };
test("last enabled layer covers only overlapping audio and keeps non-overlapping portions", () => {
  assert.deepEqual(
    audioLayerSegments(recording).map((s) => [
      s.file,
      s.trim.startSeconds,
      s.trim.endSeconds,
    ]),
    [
      [base.file, 0, 2],
      [first.file, 0, 6],
      [last.file, 0, 4],
      [base.file, 9, 10],
    ],
  );
  assert.equal(audioLayerText(recording), "01ABCWXYZ9");
  const reversed = { ...recording, layers: [last, first] };
  assert.deepEqual(
    audioLayerSegments(reversed).map((s) => [
      s.file,
      s.trim.startSeconds,
      s.trim.endSeconds,
    ]),
    [
      [base.file, 0, 2],
      [first.file, 0, 10],
      [last.file, 2, 4],
      [base.file, 9, 10],
    ],
  );
  assert.equal(audioLayerText(reversed), "01ABCDEYZ9");
});
test("identical patches remain independent; hiding or deleting reveals earlier audio", () => {
  const duplicate = {
    ...first,
    revision: "duplicate",
    file: "jude/duplicate/phrase.wav",
  };
  const layers = [first, duplicate];
  const edits = orderedAudioLayers(layers, [
    { revision: duplicate.revision, enabled: false },
    { revision: first.revision, enabled: true },
  ]);
  assert.equal(edits.length, 2);
  assert.deepEqual(
    audioLayerSegments({ ...recording, layers: edits }),
    audioLayerSegments({ ...recording, layers: [first] }),
  );
  assert.deepEqual(audioLayerSegments({ ...recording, layers: [] }), [
    { file: base.file, trim: { startSeconds: 0, endSeconds: 10 }, pause: 0 },
  ]);
  assert.throws(() =>
    orderedAudioLayers(layers, [{ revision: "unknown", enabled: true }]),
  );
  assert.throws(() =>
    orderedAudioLayers(layers, [
      { revision: "first", enabled: true },
      { revision: "first", enabled: false },
    ]),
  );
});
test("full-verse layers retain the base and support shorter or longer alternatives", () => {
  const full = layer("full", 0, 10, 3, "replacement");
  assert.deepEqual(
    audioLayerSegments({ ...recording, layers: [first, full] }),
    [{ file: full.file, trim: { startSeconds: 0, endSeconds: 3 }, pause: 0 }],
  );
  assert.equal(
    audioLayerText({ ...recording, layers: [first, full] }),
    "replacement",
  );
});
test("recording schema preserves layers and rejects invalid base coordinates", () => {
  assert.deepEqual(audioRecordingSchema.parse(recording), recording);
  assert.equal(
    audioRecordingSchema.safeParse({
      ...recording,
      layers: [{ ...first, end: 11 }],
    }).success,
    false,
  );
  assert.equal(
    audioRecordingSchema.safeParse({ ...recording, base: undefined }).success,
    false,
  );
  assert.equal(
    audioGenerateSchema.safeParse({ chapter: 1, verse: 1, layerEdits: [] })
      .success,
    true,
  );
  assert.equal(
    audioGenerateSchema.safeParse({ chapter: 1, layerEdits: [] }).success,
    false,
  );
  assert.equal(
    audioGenerateSchema.safeParse({
      chapter: 1,
      verse: 1,
      layerEdits: [],
      regenerate: true,
    }).success,
    false,
  );
});
