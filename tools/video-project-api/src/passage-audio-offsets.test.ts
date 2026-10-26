import assert from "node:assert/strict";
import { test } from "node:test";
import * as long from "./engines/long/episodes.js";
import * as short from "./engines/short/shorts.js";

for (const [kind, engine] of [
  ["long/book", long],
  ["short", short],
] as const) {
  test(`${kind}: full chapters use exact source boundaries, including the last verse`, () => {
    const verses = [
      { verse: 1, text: Array(200).fill("word").join(" ") },
      { verse: 2, text: Array(231).fill("word").join(" ") },
    ];
    const duration = 451.789;
    assert.ok(
      (duration * 431) / 431 > duration,
      "fixture reproduces the previous rounding overrun",
    );
    const full = engine.estimateAudioRange(verses, 1, 2, duration);
    assert.deepEqual(full, { start: 0, end: duration });
    const last = engine.estimateAudioRange(verses, 2, 2, duration);
    assert.equal(last.end, duration);
    assert.equal(last.start, (duration * 200) / 431);
  });

  test(`${kind}: a rounded intermediate chapter cannot block a whole-book analysis`, () => {
    const duration = 451.789;
    const sections = [
      { file: "first.mp3", start: 0, end: 10 },
      { file: "middle.mp3", start: 0, end: (duration * 431) / 431 },
      { file: "last.mp3", start: 0, end: 20 },
    ];
    const result = engine.applyPassageAudioOffsets(
      sections,
      [10, duration, 20],
      { startSeconds: 0.5, endSeconds: -0.5 },
    );
    assert.equal(result[0].start, 0.5);
    assert.equal(result[1].end, duration);
    assert.equal(result[2].end, 19.5);
    assert.ok(sections[1].end > duration, "source sections are not mutated");
  });

  test(`${kind}: boundary cancellation tolerates roundoff but rejects real overruns and reversed cuts`, () => {
    const sections = [{ file: "chapter.mp3", start: 0.3, end: 0.9 }];
    assert.deepEqual(
      engine.applyPassageAudioOffsets(sections, [1], {
        startSeconds: -(0.1 + 0.2),
        endSeconds: 0.1,
      }),
      [{ file: "chapter.mp3", start: 0, end: 1 }],
    );
    for (const offsets of [
      { startSeconds: -0.300001, endSeconds: 0 },
      { startSeconds: 0, endSeconds: 0.100001 },
      { startSeconds: 0.7, endSeconds: 0 },
    ])
      assert.throws(
        () => engine.applyPassageAudioOffsets(sections, [1], offsets),
        /invalid audio cut/,
      );
    assert.deepEqual(
      engine.applyPassageAudioOffsets(sections, [1], {
        startSeconds: 0,
        endSeconds: 0,
      }),
      sections,
    );
    for (const duration of [NaN, Infinity, 0, -1])
      assert.throws(
        () =>
          engine.applyPassageAudioOffsets(sections, [duration], {
            startSeconds: 0,
            endSeconds: 0,
          }),
        /invalid audio cut/,
      );
  });
}
