import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AlignmentInspectionUpdates,
  inspectionUpdate,
} from "./inspection-updates.js";
import type { AlignmentJob } from "./forced-alignment-result.js";

test("render and voice cursors return unchanged responses and detect new values", () => {
  const initial = inspectionUpdate(
    { state: { status: "running", progress: 10 } },
    null,
  );
  assert.deepEqual(
    inspectionUpdate(
      { state: { status: "running", progress: 10 } },
      initial.cursor,
    ),
    { unchanged: true, cursor: initial.cursor },
  );
  const next = inspectionUpdate(
    { state: { status: "ready", progress: 100 } },
    initial.cursor,
  );
  assert.notEqual(next.cursor, initial.cursor);
  assert.ok("state" in next);
  const voices = inspectionUpdate(
    { voices: { intro: { available: false } } },
    null,
  );
  assert.deepEqual(
    inspectionUpdate(
      { voices: { intro: { available: false } } },
      voices.cursor,
    ),
    { unchanged: true, cursor: voices.cursor },
  );
});

test("alignment sends each completed result once, tracks live progress, isolates cursors and recovers on restart", (t) => {
  const updates = new AlignmentInspectionUpdates();
  const completed: AlignmentJob = {
    id: "first",
    status: "done",
    stage: "Complete",
    progress: 100,
    result: {
      signature: "scope",
      offsets: Array.from({ length: 1500 }, (_, i) => ({
        reference: String(i),
        startOffsetSeconds: 0,
        endOffsetSeconds: 1,
      })),
      padding: [],
      model: "fixture",
    },
  };
  const jobs = [completed];
  const first = updates.read("project", jobs, null);
  assert.deepEqual(first.jobs, jobs);
  const same = updates.read("project", jobs, first.cursor);
  assert.equal(same.unchanged, true);
  assert.equal(same.jobs, undefined);
  assert.ok(JSON.stringify(same).length < 100);
  t.diagnostic(
    `Alignment history ${JSON.stringify(first).length} bytes; unchanged update ${JSON.stringify(same).length} bytes.`,
  );
  const running: AlignmentJob = {
    id: "second",
    status: "running",
    stage: "Aligning",
    progress: 20,
  };
  jobs.push(running);
  const discovered = updates.read("project", jobs, same.cursor);
  assert.deepEqual(discovered.jobs, [running]);
  running.progress = 45;
  const progress = updates.read("project", jobs, discovered.cursor);
  assert.deepEqual(progress.jobs, [running]);
  running.status = "done";
  running.progress = 100;
  running.result = {
    signature: "scope2",
    offsets: [],
    padding: [],
    model: "fixture",
  };
  const finished = updates.read("project", jobs, progress.cursor);
  assert.equal(finished.jobs![0].result, running.result);
  assert.equal(updates.read("project", jobs, finished.cursor).unchanged, true);
  assert.deepEqual(
    new AlignmentInspectionUpdates().read("project", jobs, finished.cursor)
      .jobs,
    jobs,
  );
  assert.deepEqual(
    updates.read("other-environment", jobs, finished.cursor).jobs,
    jobs,
  );
  assert.deepEqual(updates.read("project", jobs, "broken").jobs, jobs);
});
