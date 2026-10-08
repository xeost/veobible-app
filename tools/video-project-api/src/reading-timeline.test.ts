import { test } from "node:test";
import assert from "node:assert/strict";
import { trimReadingTail } from "./reading-timeline.js";

test("the adjusted final verse removes the extra wait before the outro", () => {
  const sections = [
    { file: "chapter.mp3", start: 204.535042, end: 267.546125 },
  ];
  const reading = trimReadingTail(sections, [{ end: 56.47 }, { end: 60.563 }]);
  assert.equal(reading.duration, 60.563);
  assert.equal(reading.sections[0].end, 265.098042);
  assert.equal(sections[0].end, 267.546125);
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
