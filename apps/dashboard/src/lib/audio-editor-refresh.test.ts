import { test } from "node:test";
import assert from "node:assert/strict";
import { refreshAudioEditor } from "./audio-editor-refresh";
import type { AudioProjectDetail } from "../../../../tools/video-project-api/src/audio-project-schema";

test("editor loads text once, preserves it across changes and skips unchanged state", async () => {
  const calls: string[] = [];
  const content = [
    { chapter: 1, verses: [{ verse: 1, text: "In the beginning" }] },
  ];
  let state: any = {
    project: { revision: 7, settings: {}, recordings: {} },
    extras: { mediaAccess: "signed" },
  };
  const read = async <T>(path: string): Promise<T> => {
    calls.push(path);
    return (
      path.endsWith("/content") ? { content, originalChapters: [1] } : state
    ) as T;
  };
  const initial = await refreshAudioEditor(read, "audios/edition/book", null);
  assert.deepEqual(calls, [
    "audios/edition/book/state",
    "audios/edition/book/content",
  ]);
  assert.equal(initial.project!.content, content);
  calls.length = 0;
  state = { unchanged: true, revision: 7 };
  const idle = await refreshAudioEditor(
    read,
    "audios/edition/book",
    initial.project as AudioProjectDetail,
  );
  assert.equal(idle.project, null);
  assert.deepEqual(calls, ["audios/edition/book/state?revision=7"]);
  state = {
    project: {
      revision: 8,
      settings: {},
      recordings: { "1:1": { revision: "new" } },
    },
  };
  const updated = await refreshAudioEditor(
    read,
    "audios/edition/book",
    initial.project as AudioProjectDetail,
  );
  assert.equal(updated.project!.content, content);
  assert.deepEqual(updated.project!.originalChapters, [1]);
  assert.equal(updated.project!.recordings["1:1"].revision, "new");
});
