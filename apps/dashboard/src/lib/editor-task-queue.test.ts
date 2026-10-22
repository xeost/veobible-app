import { test } from "node:test";
import assert from "node:assert/strict";
import { createEditorTaskQueue } from "./editor-task-queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

for (const order of [
  ["voices", "alignment"],
  ["alignment", "voices"],
]) {
  test(`accepts ${order.join(" then ")} immediately while serializing submissions`, async () => {
    const updates: ReadonlySet<string>[] = [];
    const queue = createEditorTaskQueue((pending) => updates.push(pending));
    const firstRequest = deferred();
    const calls: string[] = [];
    let settingsRevision = 0;
    const first = queue.enqueue([order[0]], async () => {
      calls.push(order[0]);
      await firstRequest.promise;
      settingsRevision++;
    });
    const second = queue.enqueue([order[1]], async () => {
      assert.equal(settingsRevision, 1);
      calls.push(order[1]);
    });
    assert.ok(first);
    assert.ok(second);
    assert.deepEqual([...queue.pending], order);
    assert.deepEqual([...updates[1]], order);
    await Promise.resolve();
    assert.deepEqual(calls, [order[0]]);
    firstRequest.resolve();
    await Promise.all([first, second]);
    assert.deepEqual(calls, order);
    assert.equal(queue.pending.size, 0);
    assert.equal(updates.at(-1)?.size, 0);
  });
}

test("reserves scopes before rendering to reject duplicate and overlapping clicks", async () => {
  const queue = createEditorTaskQueue(() => {});
  const request = deferred();
  const bulk = queue.enqueue(
    ["voices", "voice:intro", "voice:outro"],
    () => request.promise,
  );
  const duplicate = () => {
    assert.fail("Duplicate submission ran");
  };
  assert.equal(queue.enqueue(["voices"], duplicate), undefined);
  assert.equal(queue.enqueue(["voice:intro"], duplicate), undefined);
  assert.equal(queue.enqueue(["voice:outro"], duplicate), undefined);
  const alignment = queue.enqueue(["alignment"], async () => {});
  assert.ok(alignment);
  request.resolve();
  await Promise.all([bulk, alignment]);
});

test("a failed request releases its scopes and still submits the next accepted action", async () => {
  const queue = createEditorTaskQueue(() => {});
  const failed = queue.enqueue(["voices"], async () => {
    throw new Error("Unavailable");
  });
  let submitted = false;
  const next = queue.enqueue(["alignment"], async () => {
    submitted = true;
  });
  await assert.rejects(failed!, /Unavailable/);
  await next;
  assert.equal(submitted, true);
  assert.equal(queue.pending.size, 0);
  const retry = queue.enqueue(["voices"], async () => {});
  assert.ok(retry);
  await retry;
});

test("accepts voice and alignment actions from several blocks while an earlier request is pending", async () => {
  const queue = createEditorTaskQueue(() => {});
  const request = deferred();
  const applied = queue.enqueue(["alignment-apply"], () => request.promise);
  const calls: string[] = [];
  const scopes = [
    "voice:reading-0",
    "alignment-0",
    "alignment-1",
    "voice:reading-1",
  ];
  const submissions = scopes.map((scope) => {
    const submission = queue.enqueue([scope], async () => {
      calls.push(scope);
    });
    assert.ok(submission);
    return submission;
  });
  assert.deepEqual([...queue.pending], ["alignment-apply", ...scopes]);
  assert.deepEqual(calls, []);
  request.resolve();
  await Promise.all([applied, ...submissions]);
  assert.deepEqual(calls, scopes);
});

test("whole-passage analysis conflicts with an affected block in either submission order", async () => {
  const block = ["alignment-1"];
  const all = ["alignment", "alignment-0", "alignment-1"];
  for (const [first, second] of [
    [block, all],
    [all, block],
  ]) {
    const queue = createEditorTaskQueue(() => {});
    const request = deferred();
    const submission = queue.enqueue(first, () => request.promise);
    assert.equal(
      queue.enqueue(second, async () => {
        assert.fail("Overlapping analysis ran");
      }),
      undefined,
    );
    request.resolve();
    await submission;
  }
});
