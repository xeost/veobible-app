import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustedCues,
  readingTimeline,
  trimCue,
  trimPreviewRange,
  waveformSeekRange,
  validVerseTimings,
  waveformWindow,
} from "./video-timing";
import { applyVerseOffsets } from "../../../../tools/video-project-api/src/engines/short/verse-timing";
const cues = [
  { reference: "Juan 3:14", text: "Primero", start: 0, end: 4.00042 },
  { reference: "Juan 3:15", text: "Segundo", start: 4.00042, end: 9 },
];
test("trim previews play the first or last three seconds of the updated fragment", () => {
  const cue = { start: 32.5, end: 40.7 };
  assert.deepEqual(trimPreviewRange(cue, "start"), { start: 32.5, end: 35.5 });
  assert.deepEqual(trimPreviewRange(cue, "end"), { start: 37.7, end: 40.7 });
  const short = { start: 32, end: 33.5 };
  assert.deepEqual(trimPreviewRange(short, "start"), short);
  assert.deepEqual(trimPreviewRange(short, "end"), short);
});
test("waveform clicks play to the fragment end and ignore the surrounding context", () => {
  const cue = { start: 32, end: 40 };
  assert.deepEqual(waveformSeekRange(cue, 35.25), { start: 35.25, end: 40 });
  assert.deepEqual(waveformSeekRange(cue, 32), cue);
  assert.equal(waveformSeekRange(cue, 31.99), null);
  assert.equal(waveformSeekRange(cue, 40), null);
  assert.equal(waveformSeekRange(cue, 42), null);
});
test("trim handles reach both waveform edges beyond neighboring verses while retaining audio bounds", () => {
  assert.equal(trimCue(cues, 0, "end", 8, 0, 9), 8);
  assert.equal(trimCue(cues, 1, "start", -5, 0, 9), 0);
  assert.equal(trimCue(cues, 1, "end", 20, 0, 9), 9);
  assert.equal(trimCue(cues, 0, "start", -20, 0, 9), 0);
  assert.equal(trimCue(cues, 0, "start", 9, 0, 9), 3.98042);
});
test("saved trim offsets produce exactly the same timings in the video renderer", () => {
  const offsets = [
    {
      reference: "Juan 3:14",
      startOffsetSeconds: 0.15,
      endOffsetSeconds: -0.4,
    },
  ];
  assert.deepEqual(
    adjustedCues(cues, offsets),
    applyVerseOffsets(cues, offsets),
  );
  assert.equal(validVerseTimings(adjustedCues(cues, offsets), 9), true);
  assert.equal(
    validVerseTimings(
      adjustedCues(cues, [{ ...offsets[0], endOffsetSeconds: 1 }]),
      9,
    ),
    true,
  );
  assert.deepEqual(
    adjustedCues(cues, [{ ...offsets[0], endOffsetSeconds: 1 }]),
    applyVerseOffsets(cues, [{ ...offsets[0], endOffsetSeconds: 1 }]),
  );
  assert.equal(validVerseTimings([{ ...cues[0], start: 5, end: 4 }], 9), false);
  assert.equal(validVerseTimings([{ ...cues[0], end: 10 }], 9), false);
});
test("multiple chapter sections map reading timeline time into source audio time", () => {
  const sections = readingTimeline([
    { start: 32, end: 41 },
    { start: 8, end: 23 },
  ]);
  assert.equal(sections[1].timelineStart, 9);
  assert.equal(sections[1].timelineEnd, 24);
  // A verse at reading time 12 is heard at second 11 of the second audio file.
  assert.equal(sections[1].start + 12 - sections[1].timelineStart, 11);
});

test("waveform focuses the selected fragment with five seconds on both sides", () => {
  assert.deepEqual(waveformWindow({ start: 20, end: 24 }, 0, 90), {
    start: 15,
    end: 29,
  });
  assert.deepEqual(waveformWindow({ start: 40, end: 47 }, 0, 90), {
    start: 35,
    end: 52,
  });
});
test("waveform context respects the source section boundaries on a multi-section timeline", () => {
  assert.deepEqual(waveformWindow({ start: 32, end: 34 }, 30, 50), {
    start: 30,
    end: 39,
  });
  assert.deepEqual(waveformWindow({ start: 44, end: 48 }, 30, 50), {
    start: 39,
    end: 50,
  });
});
