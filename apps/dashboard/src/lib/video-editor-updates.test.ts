import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeVideoAlignmentUpdates,
  serializeVideoRefresh,
} from "./video-editor-updates";
import type { AlignmentJob } from "../../../../tools/video-project-api/src/forced-alignment-result";

test("incremental alignment retains finished results skipped while the editor was busy", () => {
  const done: AlignmentJob = {
    id: "done",
    status: "done",
    progress: 100,
    stage: "Complete",
    result: { signature: "scope", offsets: [], padding: [], model: "fixture" },
  };
  const queued: AlignmentJob = {
    id: "queued",
    status: "queued",
    progress: 0,
    stage: "Queued",
  };
  const current = [done, queued];
  const unchanged = mergeVideoAlignmentUpdates(current, {
    cursor: "same",
    unchanged: true,
  });
  assert.equal(unchanged, current);
  assert.equal(unchanged[0].result, done.result);
  const running = { ...queued, status: "running" as const, progress: 45 };
  const updated = mergeVideoAlignmentUpdates(current, {
    cursor: "next",
    jobs: [running],
  });
  assert.deepEqual(
    updated.map((job) => [job.id, job.status]),
    [
      ["queued", "running"],
      ["done", "done"],
    ],
  );
  assert.equal(updated[1].result, done.result);
});

test("poll/focus requests serialize, coalesce repeated focus and recover after a failure", async () => {
  const calls: boolean[] = [];
  let finish!: () => void;
  let fail = false;
  const refresh = serializeVideoRefresh(async (full) => {
    calls.push(full);
    if (fail) throw new Error("offline");
    if (calls.length === 1)
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
  });
  const poll = refresh();
  assert.equal(refresh(), poll);
  assert.equal(refresh(true), poll);
  assert.equal(refresh(true), poll);
  finish();
  await poll;
  assert.deepEqual(calls, [false, true]);
  fail = true;
  await assert.rejects(refresh(), /offline/);
  fail = false;
  await refresh();
  assert.deepEqual(calls, [false, true, false, false]);
});
