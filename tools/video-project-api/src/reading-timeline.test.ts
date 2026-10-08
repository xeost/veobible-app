import { test } from "node:test";
import assert from "node:assert/strict";
import { trimReadingTail, buildVerseReading, applyReadingCuts, expandReadingContext } from "./reading-timeline.js";
import { verseTextPhases, verseAnimationSpans } from "./verse-animation.js";

test("the adjusted final verse removes the extra wait before the outro", () => {
  const sections = [
    { file: "chapter.mp3", start: 204.535042, end: 267.546125 },
  ];
  const reading = trimReadingTail(sections, [{ end: 56.47 }, { end: 60.563 }]);
  assert.equal(reading.duration, 60.563);
  assert.equal(reading.sections[0].end, 265.098042);
  assert.equal(sections[0].end, 267.546125);
});

test("independent verse cuts omit unselected audio and replay intentional source overlaps", () => {
  const sections = [{ file: "chapter.mp3", start: 10, end: 30 }];
  const cues = [{ start: 2, end: 5 }, { start: 4, end: 8 }, { start: 10, end: 12 }];
  const reading = buildVerseReading(sections, cues, [3, 5, 2]);
  assert.deepEqual(reading.sections.map(({ file, start, end }) => ({ file, start, end })), [
    { file: "chapter.mp3", start: 12, end: 15 },
    { file: "chapter.mp3", start: 14, end: 18 },
    { file: "chapter.mp3", start: 20, end: 22 },
  ]);
  assert.equal(reading.cues[0].start, 0);
  assert.ok(reading.cues[1].start > reading.cues[0].end);
  assert.equal(cues[0].start, 2);
  assert.equal(reading.duration, reading.cues.at(-1)!.end);
});

test("a verse crossing audio files remains continuous within its own cut", () => {
  const reading = buildVerseReading([
    { file: "first.mp3", start: 20, end: 25 }, { file: "second.mp3", start: 7, end: 12 },
  ], [{ start: 3, end: 7 }], [2]);
  assert.deepEqual(reading.sections, [
    { file: "first.mp3", start: 23, end: 25, timelineStart: 0 },
    { file: "second.mp3", start: 7, end: 9, timelineStart: 2 },
  ]);
  assert.equal(reading.duration, 4);
});

test("every line is fully entered throughout narration and exits only in the silent transition", () => {
  for (const duration of [0.3, 2, 6]) {
    const counts = [2, 8, 4];
    const reading = buildVerseReading([{ file: "audio.wav", start: 0, end: 30 }], [
      { start: 0, end: duration }, { start: 7, end: 7 + duration }, { start: 20, end: 20 + duration },
    ], counts);
    reading.cues.forEach((cue, index) => {
      const phases = verseTextPhases(reading.cues, counts, index, 1);
      for (const phase of phases) {
        assert.ok(phase.start + phase.duration <= 1 + cue.start + 1e-9);
        assert.ok(phase.exit >= 1 + cue.end - 1e-9);
      }
      if (index > 0) {
        const previous = verseTextPhases(reading.cues, counts, index - 1, 1);
        const finished = Math.max(...previous.map((phase) => phase.exit + phase.exitDuration));
        assert.ok(Math.min(...phases.map((phase) => phase.start)) >= finished - 1e-9);
      }
    });
    const expectedGap = verseAnimationSpans(duration, counts[0]).exit + verseAnimationSpans(duration, counts[1]).entrance;
    assert.ok(Math.abs(reading.cues[1].start - reading.cues[0].end - expectedGap) < 1e-9);
  }
});

test("trimming across chapters preserves earlier sections and overlapping verse endings", () => {
  const sections = [
    { file: "first.mp3", start: 10, end: 20 },
    { file: "second.mp3", start: 0, end: 30 },
    { file: "third.mp3", start: 2, end: 10 },
  ];
  const reading = trimReadingTail(sections, [{ end: 18 }, { end: 16 }]);
  assert.deepEqual(reading, {
    duration: 18,
    sections: [sections[0], { file: "second.mp3", start: 0, end: 8 }],
  });
  assert.deepEqual(trimReadingTail(sections, [{ end: 48 }]).sections, sections);
});

test("rendering keeps the editor's exact cuts instead of refreshed timing estimates", () => {
  const estimates = [
    { reference: "first", text: "First verse", start: 0, end: 5 },
    { reference: "second", text: "Second verse", start: 5, end: 10 },
  ];
  const cuts = [
    { reference: "first", start: 0.375, end: 3.725 },
    { reference: "second", start: 6.125, end: 11.25 },
  ];
  const cues = applyReadingCuts(estimates, cuts, 12);
  assert.equal(cues[0].text, "First verse");
  const reading = buildVerseReading([{ file: "chapter.mp3", start: 20, end: 32 }], cues, [2, 3]);
  assert.deepEqual(reading.sections.map(({ start, end }) => ({ start, end })), [
    { start: 20.375, end: 23.725 }, { start: 26.125, end: 31.25 },
  ]);
  assert.equal(reading.duration, reading.cues[1].end);
  assert.deepEqual(applyReadingCuts(estimates, undefined, 12), estimates);
  for (const invalid of [cuts.slice(1), [cuts[0], cuts[0]], [cuts[0], { ...cuts[1], reference: "unknown" }],
    [cuts[0], { ...cuts[1], end: 13 }], [cuts[0], { ...cuts[1], start: 11.5 }]]) {
    assert.throws(() => applyReadingCuts(estimates, invalid, 12));
  }
});

test("expanding both ends preserves existing source cuts and shifts later chapters consistently", () => {
  const sources = [{ file: "first.mp3", start: 30, end: 50 }, { file: "second.mp3", start: 15, end: 35 }];
  const cues = [{ reference: "first", start: 1, end: 10 }, { reference: "last", start: 22, end: 35 }];
  const padding = [{ sectionIndex: 0, beforeSeconds: 10, afterSeconds: 10 }, { sectionIndex: 1, beforeSeconds: 10, afterSeconds: 10 }];
  const expanded = expandReadingContext(sources, cues, [100, 60], padding);
  assert.deepEqual(expanded.sections.map(({ start, end }) => ({ start, end })), [{ start: 20, end: 60 }, { start: 5, end: 45 }]);
  assert.deepEqual(expanded.cues.map(({ start, end }) => ({ start, end })), [{ start: 11, end: 20 }, { start: 52, end: 65 }]);
  const before = buildVerseReading(sources, cues, [2, 2]);
  const after = buildVerseReading(expanded.sections, expanded.cues, [2, 2]);
  assert.deepEqual(after.sections, before.sections);
  // Repeated clicks extend from the current range; persisted totals reproduce that range on reopening.
  const repeated = expandReadingContext(expanded.sections, expanded.cues, [100, 60], [{ sectionIndex: 0, beforeSeconds: 10, afterSeconds: 0 }]);
  const reopened = expandReadingContext(sources, cues, [100, 60], [{ ...padding[0], beforeSeconds: 20 }, padding[1]]);
  assert.deepEqual(repeated, reopened);
  // Newly exposed audio can be selected and rendered with exact source coordinates.
  const adjusted = [{ ...expanded.cues[0], start: 0 }, { ...expanded.cues[1], end: 80 }];
  const selected = buildVerseReading(expanded.sections, adjusted, [2, 2]);
  assert.equal(selected.sections[0].start, 20);
  assert.equal(selected.sections.at(-1)!.end, 45);
});

test("context expansion stops at real file boundaries and rejects unknown or repeated sections", () => {
  const sources = [{ start: 4, end: 18 }];
  const cues = [{ start: 0, end: 14 }];
  const entry = { sectionIndex: 0, beforeSeconds: 10, afterSeconds: 10 };
  const expanded = expandReadingContext(sources, cues, [20], [entry]);
  assert.deepEqual(expanded.sections, [{ start: 0, end: 20 }]);
  assert.deepEqual(expanded.cues, [{ start: 4, end: 18 }]);
  assert.throws(() => expandReadingContext(sources, cues, [20], [entry, entry]));
  assert.throws(() => expandReadingContext(sources, cues, [20], [{ ...entry, sectionIndex: 1 }]));
  assert.throws(() => expandReadingContext(sources, cues, [20], [{ ...entry, beforeSeconds: -1 }]));
});

test("manual offsets can reach the new audio boundaries in both formats", async () => {
  const cue = [{ reference: "last", text: "Last verse", start: 4, end: 18 }];
  const offset = [{ reference: "last", startOffsetSeconds: -4, endOffsetSeconds: 2 }];
  for (const kind of ["short", "long"]) {
    const { applyVerseOffsets } = await import(`./engines/${kind}/verse-timing.js`);
    assert.deepEqual(applyVerseOffsets(cue, offset, 20), [{ ...cue[0], start: 0, end: 20 }]);
    assert.throws(() => applyVerseOffsets(cue, [{ ...offset[0], endOffsetSeconds: 3 }], 20));
  }
});
