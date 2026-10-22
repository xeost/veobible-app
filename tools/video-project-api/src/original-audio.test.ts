import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { OriginalAudioComparisons } from "./original-audio.js";

const project = {
  version: {
    id: 1,
    code: "rv1909",
    locale: "es" as const,
    label: "Reina Valera",
  },
  book: "genesis",
  order: 1,
  chapterCount: 2,
};
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "original-comparison-"));
  let alignments = 0,
    fail = false;
  const verses = [
    { verse: 1, text: "First verse." },
    { verse: 2, text: "Second verse." },
  ];
  const runs: (() => Promise<void>)[] = [];
  const comparisons = new OriginalAudioComparisons(root, {
    duration: async () => 10,
    verses: async () => verses,
    align: async (
      audio,
      duration,
      language,
      segments,
      _ffmpeg,
      progress,
      detectHeadings,
    ) => {
      alignments++;
      assert.equal(audio, path.join(root, "rv1909", "01-genesis-1.mp3"));
      assert.equal(duration, 10);
      assert.equal(language, "es");
      assert.equal(detectHeadings, true);
      assert.deepEqual(
        segments.map((segment) => segment.id),
        ["1:1", "1:2"],
      );
      progress(50);
      if (fail) throw new Error("test alignment failure");
      return {
        model: "fixture",
        cues: segments.map((segment, index) => ({
          reference: segment.id,
          text: segment.text,
          start: index * 4 + 0.5,
          end: index * 4 + 3.5,
        })),
      };
    },
  });
  const enqueue = (run: () => Promise<void>) => {
    runs.push(run);
  };
  const addOriginal = async () => {
    await fs.mkdir(path.join(root, "rv1909"), { recursive: true });
    await fs.writeFile(
      path.join(root, "rv1909", "01-genesis-1.mp3"),
      "human recording",
    );
  };
  return {
    root,
    comparisons,
    verses,
    runs,
    enqueue,
    addOriginal,
    count: () => alignments,
    fail: (value: boolean) => {
      fail = value;
    },
    clean: () => fs.rm(root, { recursive: true, force: true }),
  };
}

test("only real unsuffixed chapter recordings enable comparison, without loading the model", async () => {
  const f = await fixture();
  try {
    await fs.mkdir(path.join(f.root, "rv1909-v2"));
    await fs.writeFile(
      path.join(f.root, "rv1909-v2", "01-genesis-1.mp3"),
      "generated",
    );
    assert.deepEqual(await f.comparisons.availableChapters(project), []);
    assert.equal(
      (await f.comparisons.inspect(project, 1, true, f.enqueue)).available,
      false,
    );
    assert.equal(f.runs.length, 0);
    await f.addOriginal();
    assert.deepEqual(await f.comparisons.availableChapters(project), [1]);
    assert.equal(
      (await f.comparisons.inspect(project, 1, false, f.enqueue)).status,
      "idle",
    );
    assert.equal(f.runs.length, 0);
    assert.equal(f.count(), 0);
    await assert.rejects(f.comparisons.source(project, 0));
    await assert.rejects(f.comparisons.source(project, 3));
    await assert.rejects(
      f.comparisons.source({ ...project, book: "../genesis" }, 1),
    );
    await fs.symlink(
      path.join(f.root, "rv1909", "01-genesis-1.mp3"),
      path.join(f.root, "rv1909", "01-genesis-2.mp3"),
    );
    assert.equal(await f.comparisons.source(project, 2), null);
  } finally {
    await f.clean();
  }
});

test("chapter analysis is deduplicated across verse requests, stays read-only and invalidates when recordings or text change", async () => {
  const f = await fixture();
  try {
    await f.addOriginal();
    const first = await Promise.all([
      f.comparisons.inspect(project, 1, true, f.enqueue),
      f.comparisons.inspect(project, 1, true, f.enqueue),
    ]);
    assert.ok(first.every((state) => state.status === "queued"));
    assert.equal(f.runs.length, 1);
    await f.runs.shift()!();
    const result = await f.comparisons.inspect(project, 1, false, f.enqueue);
    assert.equal(result.status, "done");
    assert.equal(
      result.cues?.find((cue) => cue.reference === "1:2")?.start,
      4.5,
    );
    assert.equal(result.cues?.find((cue) => cue.reference === "1:1")?.end, 3.5);
    await f.comparisons.inspect(project, 1, true, f.enqueue);
    assert.equal(f.runs.length, 0);
    assert.equal(f.count(), 1);
    const audio = await f.comparisons.media(project, 1, result.revision!);
    assert.equal(await fs.readFile(audio, "utf8"), "human recording");
    await fs.appendFile(audio, " updated");
    await assert.rejects(
      f.comparisons.media(project, 1, result.revision!),
      /changed/,
    );
    assert.equal(
      (await f.comparisons.inspect(project, 1, false, f.enqueue)).status,
      "idle",
    );
    await f.comparisons.inspect(project, 1, true, f.enqueue);
    await f.runs.shift()!();
    assert.equal(f.count(), 2);
    f.verses[0].text = "Edited Bible text.";
    assert.equal(
      (await f.comparisons.inspect(project, 1, false, f.enqueue)).status,
      "idle",
    );
    await f.comparisons.inspect(project, 1, true, f.enqueue);
    await f.runs.shift()!();
    assert.equal(f.count(), 3);
    assert.deepEqual(await fs.readdir(path.join(f.root, "rv1909")), [
      "01-genesis-1.mp3",
    ]);
    assert.equal(await fs.readFile(audio, "utf8"), "human recording updated");
  } finally {
    await f.clean();
  }
});

test("failed comparisons can be retried without altering recordings", async () => {
  const f = await fixture();
  try {
    await f.addOriginal();
    f.fail(true);
    await f.comparisons.inspect(project, 1, true, f.enqueue);
    await assert.rejects(f.runs.shift()!(), /test alignment failure/);
    assert.equal(
      (await f.comparisons.inspect(project, 1, false, f.enqueue)).status,
      "failed",
    );
    f.fail(false);
    await f.comparisons.inspect(project, 1, true, f.enqueue);
    await f.runs.shift()!();
    assert.equal(
      (await f.comparisons.inspect(project, 1, false, f.enqueue)).status,
      "done",
    );
    assert.equal(f.count(), 2);
  } finally {
    await f.clean();
  }
});
