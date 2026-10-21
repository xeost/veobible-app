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
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  queue.enqueue(
    {
      projectId: 1,
      kind: "short",
      type: "intro",
      outputEnvironment: "development",
    },
    job("dev-intro"),
    () => gate,
  );
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

test("queue progress includes completed work, waiting work and the active task, then resets for a new batch", async () => {
  const queue = new GenerationQueue();
  const first = job("first"),
    second = job("second"),
    next = job("next");
  let releaseFirst!: () => void,
    releaseSecond!: () => void,
    releaseNext!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const nextGate = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  queue.enqueue(
    {
      projectId: 1,
      kind: "short",
      type: "intro",
      outputEnvironment: "development",
    },
    first,
    () => firstGate,
  );
  queue.enqueue(
    { projectId: 2, kind: "long", type: "video" },
    second,
    () => secondGate,
  );
  await new Promise((resolve) => setImmediate(resolve));
  first.progress = 40;
  assert.equal(queue.snapshot()[0].progress, 40);
  assert.equal(queue.snapshot()[1].progress, 0);
  assert.deepEqual(queue.summary(), { progress: 20, completed: 0, total: 2 });
  assert.deepEqual(queue.summary("development"), {
    progress: 40,
    completed: 0,
    total: 1,
  });
  releaseFirst();
  await new Promise((resolve) => setImmediate(resolve));
  second.progress = 20;
  assert.deepEqual(queue.summary(), { progress: 60, completed: 1, total: 2 });
  assert.equal(queue.snapshot()[0].progress, 100);
  second.progress = 110;
  assert.equal(queue.snapshot()[1].progress, 100);
  assert.equal(queue.summary().progress, 99);
  releaseSecond();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(queue.summary(), { progress: 100, completed: 2, total: 2 });
  queue.enqueue(
    { projectId: 3, kind: "short", type: "outro" },
    next,
    () => nextGate,
  );
  assert.deepEqual(queue.summary(), { progress: 0, completed: 0, total: 1 });
  releaseNext();
  await new Promise((resolve) => setImmediate(resolve));
});
test("failed work is settled in the queue total while retaining its last individual progress", async (context) => {
  context.mock.method(console, "error", () => {});
  const queue = new GenerationQueue(),
    failed = job("failure");
  queue.enqueue(
    { projectId: 1, kind: "short", type: "intro" },
    failed,
    async () => {
      failed.progress = 35;
      throw new Error("Synthetic failure");
    },
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queue.snapshot()[0].progress, 35);
  assert.deepEqual(queue.summary(), { progress: 100, completed: 1, total: 1 });
});

test("audio groups share the video queue, expose individual progress and settle failed remaining tasks", async () => {
  const queue = new GenerationQueue();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let finished!: () => void;
  const end = new Promise<void>((resolve) => {
    finished = resolve;
  });
  const first = job("audio-1"),
    second = job("audio-2"),
    chapter = job("chapter");
  const metadata = {
    projectId: 1,
    kind: "audio" as const,
    outputEnvironment: "development" as const,
    chapter: 1,
  };
  queue.enqueueGroup(
    [
      { metadata: { ...metadata, type: "audio-verse", verse: 1 }, job: first },
      { metadata: { ...metadata, type: "audio-verse", verse: 2 }, job: second },
      { metadata: { ...metadata, type: "audio-chapter" }, job: chapter },
    ],
    async () => {
      first.status = "running";
      first.progress = 42;
      await gate;
      first.status = "done";
      first.progress = 100;
      second.status = "running";
      second.progress = 30;
      throw new Error("test synthesis failure");
    },
  );
  const video = job("video-after-audio");
  queue.enqueue(
    { projectId: 1, kind: "short", type: "video" },
    video,
    async () => {
      finished();
    },
  );
  await Promise.resolve();
  const before = queue.snapshot();
  assert.equal(before[0].progress, 42);
  assert.equal(before[0].verse, 1);
  assert.equal(before[1].position, 1);
  assert.equal(before[2].type, "audio-chapter");
  assert.equal(video.status, "queued");
  assert.equal(queue.summary("development").total, 3);
  release();
  await end;
  await Promise.resolve();
  assert.deepEqual(
    queue
      .snapshot()
      .slice(0, 3)
      .map((item) => item.status),
    ["done", "failed", "failed"],
  );
  assert.equal(queue.pendingCount, 0);
});
