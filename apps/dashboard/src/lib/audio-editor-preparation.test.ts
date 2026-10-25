import assert from "node:assert/strict";
import { test } from "node:test";
import type { AudioProjectDetail } from "../../../../tools/video-project-api/src/audio-project-schema";
import {
  audioEditorPreparation,
  audioWaveformResourceKey,
} from "./audio-editor-preparation";

const project: Pick<
  AudioProjectDetail,
  "edition" | "book" | "content" | "recordings"
> = {
  edition: "rv1909-v2",
  book: "genesis",
  content: [
    {
      chapter: 1,
      verses: [
        { verse: 1, text: "First" },
        { verse: 2, text: "Second" },
      ],
    },
    { chapter: 2, verses: [{ verse: 1, text: "Third" }] },
  ],
  recordings: {
    "1:1": { file: "first.wav", duration: 2, revision: "first" },
    "1:2": { file: "second.wav", duration: 2, revision: "second" },
    "2:1": { file: "third.wav", duration: 2, revision: "third" },
  },
};

test("startup follows the restored verse and waits for every mounted preview, including failures", () => {
  const expanded = new Set([1, 2]);
  const selected = { chapter: 1, verse: 2 };
  const first = audioWaveformResourceKey(project, "1:1", "first");
  const second = audioWaveformResourceKey(project, "1:2", "second");
  const third = audioWaveformResourceKey(project, "2:1", "third");
  assert.deepEqual(
    audioEditorPreparation(project, expanded, selected, { [first]: true }),
    { total: 2, completed: 0, failed: false },
  );
  assert.deepEqual(
    audioEditorPreparation(project, expanded, selected, { [second]: true }),
    { total: 2, completed: 1, failed: false },
  );
  assert.deepEqual(
    audioEditorPreparation(project, expanded, selected, {
      [second]: true,
      [third]: false,
    }),
    { total: 2, completed: 2, failed: true },
  );
  assert.deepEqual(
    audioEditorPreparation(project, expanded, selected, {
      [second]: true,
      [third]: true,
    }),
    { total: 2, completed: 2, failed: false },
  );
});

test("closed chapters, missing recordings and stale revisions do not give misleading progress", () => {
  assert.deepEqual(audioEditorPreparation(null, new Set([1]), null, {}), {
    total: 0,
    completed: 0,
    failed: false,
  });
  assert.deepEqual(audioEditorPreparation(project, new Set(), null, {}), {
    total: 0,
    completed: 0,
    failed: false,
  });
  assert.deepEqual(
    audioEditorPreparation(
      { ...project, recordings: {} },
      new Set([1]),
      null,
      {},
    ),
    { total: 0, completed: 0, failed: false },
  );
  const outdated = audioWaveformResourceKey(project, "1:1", "outdated");
  assert.deepEqual(
    audioEditorPreparation(project, new Set([1]), null, { [outdated]: true }),
    { total: 1, completed: 0, failed: false },
  );
  const otherBook = audioWaveformResourceKey(
    { ...project, book: "jude" },
    "1:1",
    "first",
  );
  assert.deepEqual(
    audioEditorPreparation(project, new Set([1]), null, { [otherBook]: true }),
    { total: 1, completed: 0, failed: false },
  );
});
