import { test } from "node:test";
import assert from "node:assert/strict";
import { readingSourceVolume } from "./reading-volume";
import { buildVerseReading } from "./reading-timeline";

test("mixed original and generated readings preserve source volume through verse scheduling", () => {
  const reading = buildVerseReading(
    [
      { file: "original.mp3", start: 0, end: 5 },
      { file: "generated.wav", start: 0, end: 5, generatedVoice: true },
    ],
    [
      { start: 0, end: 4 },
      { start: 5, end: 9 },
    ],
    [1, 1],
  );
  for (const gain of [0, 0.3, 1, 2, 4]) {
    assert.equal(readingSourceVolume(reading.sections[0], gain), gain);
    assert.equal(readingSourceVolume(reading.sections[1], gain), 1);
  }
});
