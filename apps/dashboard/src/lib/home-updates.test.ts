import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHomeRefresh,
  homeQueueKey,
  projectRenderStatus,
} from "./home-updates";
import type {
  GenerationQueueItem,
  GenerationQueueState,
} from "./generation-queue";

const video: GenerationQueueItem = {
  id: "render",
  projectId: 42,
  kind: "long",
  type: "video",
  status: "queued",
  stage: "Queued",
  progress: 0,
  position: 1,
  createdAt: "2026-10-15T00:00:00Z",
  title: "Project",
  version: "test",
  href: "/long-videos/42",
};
const queue = (items: GenerationQueueItem[]): GenerationQueueState => ({
  connected: true,
  items,
  summary: { progress: 0, completed: 0, total: 1 },
});

test("render indicators follow the matching project's video job and ignore narration and analysis", () => {
  assert.equal(projectRenderStatus(queue([video]), 42, "long"), "queued");
  assert.equal(
    projectRenderStatus(queue([{ ...video, status: "running" }]), 42, "long"),
    "running",
  );
  assert.equal(projectRenderStatus(queue([video]), 43, "long"), undefined);
  assert.equal(projectRenderStatus(queue([video]), 42, "short"), undefined);
  for (const type of [
    "intro",
    "outro",
    "chapter-0",
    "alignment",
    "alignment-0",
  ] as const)
    assert.equal(
      projectRenderStatus(queue([{ ...video, type }]), 42, "long"),
      undefined,
    );
  for (const status of ["done", "failed"] as const)
    assert.equal(
      projectRenderStatus(queue([{ ...video, status }]), 42, "long"),
      undefined,
    );
  assert.equal(
    projectRenderStatus({ ...queue([video]), connected: false }, 42, "long"),
    undefined,
  );
});

test("home refreshes on queue start, completion, failure and reconnection, not progress or history ticks", () => {
  const initial = queue([video]);
  const running = queue([{ ...video, status: "running" }]);
  const done = {
    ...queue([]),
    summary: { progress: 100, completed: 1, total: 1 },
  };
  assert.notEqual(homeQueueKey(initial), homeQueueKey(running));
  assert.notEqual(homeQueueKey(running), homeQueueKey(done));
  assert.notEqual(homeQueueKey(running), homeQueueKey(queue([])));
  assert.notEqual(
    homeQueueKey(initial),
    homeQueueKey({ ...initial, connected: false }),
  );
  assert.equal(
    homeQueueKey(running),
    homeQueueKey({
      ...running,
      items: [{ ...running.items[0], progress: 50, stage: "Reading" }],
      history: [{ ...video, status: "done" }],
      summary: { ...running.summary, progress: 50 },
    }),
  );
  assert.notEqual(homeQueueKey(queue([])), homeQueueKey(done)); // A render can start and finish between polls.
});

test("completion during a home refresh runs one follow-up so the final file is discovered without a reload", async () => {
  let rendered = false;
  let folderVisible = false;
  let calls = 0;
  let finish: () => void = () => {};
  const updates = createHomeRefresh(
    async () => {
      calls++;
      const snapshot = rendered;
      if (calls === 1)
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
      folderVisible = snapshot;
    },
    () => true,
  );
  const pending = updates.request();
  rendered = true;
  await Promise.all([updates.request(), updates.request(), updates.request()]);
  assert.equal(calls, 1);
  finish();
  await pending;
  assert.equal(calls, 2);
  assert.equal(folderVisible, true);
  updates.stop();
});

test("hidden and unmounted homes stop refreshing and failed requests can retry", async () => {
  let visible = false;
  let calls = 0;
  let signal: AbortSignal | undefined;
  const updates = createHomeRefresh(
    async (current) => {
      signal = current;
      calls++;
      if (calls === 1) throw new Error("Temporarily unavailable");
    },
    () => visible,
  );
  await updates.request();
  assert.equal(calls, 0);
  visible = true;
  await updates.request();
  await updates.request();
  assert.equal(calls, 2);
  updates.stop();
  assert.equal(signal?.aborted, true);
  await updates.request();
  assert.equal(calls, 2);
});
