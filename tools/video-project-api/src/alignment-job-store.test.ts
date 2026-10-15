import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AlignmentJobStore } from "./alignment-job-store.js";
import type { AlignmentJob } from "./forced-alignment-result.js";

const job = (sectionIndex?: number): AlignmentJob => ({
  id: crypto.randomUUID(),
  status: "queued",
  stage: "Queued",
  progress: 0,
  sectionIndex,
  createdAt: new Date().toISOString(),
});

test("concurrent requests reserve distinct sections while rejecting duplicate and whole-project work", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "alignment-store-"),
  );
  try {
    const file = path.join(directory, "1.json");
    const store = new AlignmentJobStore();
    const first = job(0),
      second = job(1);
    const accepted = await Promise.all([
      store.reserve(file, first),
      store.reserve(file, job(0)),
      store.reserve(file, second),
    ]);
    assert.deepEqual(accepted, [true, false, true]);
    assert.equal(await store.reserve(file, job()), false);
    assert.equal((await store.list(file)).length, 2);
    first.status = "done";
    second.status = "failed";
    await Promise.all([store.save(file, first), store.save(file, second)]);
    const whole = job();
    assert.equal(await store.reserve(file, whole), true);
    assert.equal(await store.reserve(file, job(2)), false);
    const recovered = await new AlignmentJobStore().list(file);
    assert.deepEqual(
      recovered.find((item) => item.id === first.id),
      JSON.parse(JSON.stringify(first)),
    );
    assert.equal(
      recovered.find((item) => item.id === second.id)?.status,
      "failed",
    );
    assert.equal(
      recovered.find((item) => item.id === whole.id)?.stage,
      "Interrupted",
    );
    assert.equal(whole.status, "queued"); // Recovery never mutates a live store.
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("legacy results and multiple interrupted jobs survive recovery without dropping other sections", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "alignment-store-"),
  );
  try {
    const file = path.join(directory, "1.json");
    const legacy = { ...job(0), status: "done" as const };
    delete legacy.createdAt;
    await fs.writeFile(file, JSON.stringify(legacy));
    const store = new AlignmentJobStore();
    assert.equal(await store.reserve(file, job(1)), true);
    assert.equal(await store.reserve(file, job(2)), true);
    const recovered = await new AlignmentJobStore().list(file);
    assert.equal(recovered.length, 3);
    assert.deepEqual(recovered[0], JSON.parse(JSON.stringify(legacy)));
    assert.deepEqual(
      recovered.slice(1).map((item) => [item.status, item.stage]),
      [
        ["failed", "Interrupted"],
        ["failed", "Interrupted"],
      ],
    );
    assert.deepEqual(await new AlignmentJobStore().list(file), recovered);
    assert.equal(
      await new AlignmentJobStore().reserve(
        path.join(directory, "other", "1.json"),
        job(1),
      ),
      true,
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
