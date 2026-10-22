import { test } from "node:test";
import assert from "node:assert/strict";
import { editorActivityLocks, editorBlockLocks } from "./editor-activity";

const idle = {
  busy: false,
  submittingTasks: false,
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

test("submitting tasks protects shared settings without blocking independent submissions", () => {
  assert.deepEqual(editorActivityLocks({ ...idle, submittingTasks: true }), {
    editingLocked: true,
    taskQueueLocked: false,
  });
});

test("saving, rendering and loading job state still protect shared settings", () => {
  for (const activity of [
    { busy: true },
    { active: true },
    { alignmentLoaded: false },
  ]) {
    assert.deepEqual(editorActivityLocks({ ...idle, ...activity }), {
      editingLocked: true,
      taskQueueLocked: true,
    });
  }
});

test("applying results protects shared settings while accepting tasks into the submission queue", () => {
  assert.deepEqual(editorActivityLocks({ ...idle, applyingAlignment: true }), {
    editingLocked: true,
    taskQueueLocked: false,
  });
});

test("submitting, running and applying work in another block leaves this block available", () => {
  for (const work of [
    { submittingTasks: true },
    { alignmentPending: true },
    { alignmentAwaitingApply: true },
    { applyingAlignment: true },
  ]) {
    assert.deepEqual(
      editorBlockLocks(
        { ...idle, ...work },
        {
          submitting: false,
          alignmentBusy: false,
          applyingAlignment: false,
        },
      ),
      { editingLocked: false, taskQueueLocked: false },
    );
  }
});

test("only the affected block protects its edits, and independent tasks can still be queued", () => {
  for (const block of [
    { submitting: true, alignmentBusy: false, applyingAlignment: false },
    { submitting: false, alignmentBusy: true, applyingAlignment: false },
    { submitting: false, alignmentBusy: false, applyingAlignment: true },
  ]) {
    assert.deepEqual(editorBlockLocks(idle, block), {
      editingLocked: true,
      taskQueueLocked: false,
    });
  }
});
