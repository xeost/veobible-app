import { test } from "node:test";
import assert from "node:assert/strict";
import { editorActivityLocks } from "./editor-activity";

const idle = {
  busy: false,
  active: false,
  applyingAlignment: false,
  alignmentLoaded: true,
  hasAnalysis: true,
  alignmentPending: false,
  alignmentAwaitingApply: false,
};

test("queued and running reading analysis leave independent narration tasks available", () => {
  assert.deepEqual(editorActivityLocks(idle), {
    editingLocked: false,
    taskQueueLocked: false,
  });
  for (const alignment of [
    { alignmentPending: true },
    { alignmentAwaitingApply: true },
    { alignmentPending: true, alignmentAwaitingApply: true },
  ]) {
    assert.deepEqual(editorActivityLocks({ ...idle, ...alignment }), {
      editingLocked: true,
      taskQueueLocked: false,
    });
  }
});

test("enqueueing, rendering, applying results and loading job state still protect shared settings", () => {
  for (const activity of [
    { busy: true },
    { active: true },
    { applyingAlignment: true },
    { alignmentLoaded: false },
  ]) {
    assert.deepEqual(editorActivityLocks({ ...idle, ...activity }), {
      editingLocked: true,
      taskQueueLocked: true,
    });
  }
});
