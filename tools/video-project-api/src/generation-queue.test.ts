import { test } from "node:test";
import assert from "node:assert/strict";
import { GenerationQueue, type QueueJob } from "./generation-queue";
const job = (id: string): QueueJob => ({
  id,
  status: "queued",
  stage: "Queued",
});
test("development work does not mark the production project as pending", async () => {
  const queue = new GenerationQueue();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  queue.enqueue({ projectId: 1, kind: "short", type: "intro", outputEnvironment: "development" }, job("dev-intro"), () => gate);
  assert.equal(queue.hasPending(1, "intro"), false);
  assert.equal(queue.hasPending(1, "intro", "development"), true);
  assert.equal(queue.snapshot()[0].outputEnvironment, "development");
  release();
  await gate;
});
test("voices from the same project and renders from other projects run in submission order", async () => {
  const queue = new GenerationQueue();
  let release!: () => void;
  let complete!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const order: string[] = [];
  const intro = job("intro"),
    outro = job("outro"),
    video = job("video");
  queue.enqueue(
    { projectId: 1, kind: "short", type: "intro" },
    intro,
    async () => {
      order.push("intro");
      await gate;
    },
  );
  queue.enqueue(
    { projectId: 1, kind: "short", type: "outro" },
    outro,
    async () => {
      order.push("outro");
    },
  );
  queue.enqueue(
    { projectId: 2, kind: "long", type: "video" },
    video,
    async () => {
      order.push("video");
      complete();
    },
  );
  await Promise.resolve();
  assert.equal(queue.pendingCount, 3);
  assert.equal(queue.hasPending(1, "intro"), true);
  assert.equal(queue.hasPending(1, "video"), false);
  assert.deepEqual(
    queue.snapshot().map((item) => [item.status, item.position]),
    [
      ["running", null],
      ["queued", 1],
      ["queued", 2],
    ],
  );
  assert.deepEqual(order, ["intro"]);
  release();
  await finished;
  await Promise.resolve();
  assert.deepEqual(order, ["intro", "outro", "video"]);
  assert.equal(queue.pendingCount, 0);
  assert.equal(queue.hasPending(1, "intro"), false);
});
test("a failed task does not block later projects and queue snapshots omit private job data", async (context) => {
  context.mock.method(console, "error", () => {});
  const queue = new GenerationQueue();
  let complete!: () => void;
  const finished = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const failed = {
    ...job("failure"),
    result: { secret: "private" },
    error: "private",
  };
  queue.enqueue(
    { projectId: 1, kind: "short", type: "intro" },
    failed,
    async () => {
      throw new Error("Synthetic generation failure");
    },
  );
  queue.enqueue(
    { projectId: 2, kind: "long", type: "video" },
    job("success"),
    async () => {
      complete();
    },
  );
  await finished;
  await Promise.resolve();
  assert.equal(queue.snapshot()[0].status, "failed");
  assert.equal(queue.snapshot()[1].status, "done");
  assert.equal("result" in queue.snapshot()[0], false);
  assert.equal("error" in queue.snapshot()[0], false);
});
