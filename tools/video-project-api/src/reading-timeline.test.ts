import { test } from "node:test";
import assert from "node:assert/strict";
import { trimReadingTail, buildVerseReading, applyReadingCuts } from "./reading-timeline.js";
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
