import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adjustedCues,
  alignSelectedVerse,
  verseHasManualCuts,
  readingTimeline,
  trimCue,
  trimPreviewRange,
  waveformSeekRange,
  validVerseTimings,
  waveformWindow,
  waveformReadingSources,
} from "./video-timing";
import { applyVerseOffsets } from "../../../../tools/video-project-api/src/engines/short/verse-timing";
import { buildVerseReading } from "../../../../tools/video-project-api/src/reading-timeline";

test("reading previews use unsaved waveform cuts against the same original chapter audio", () => {
  const sections = [
    { start: 100, end: 120 },
    { start: 40, end: 50 },
  ];
  const baseline = [
    { reference: "first", text: "First verse", start: 3, end: 6 },
    { reference: "second", text: "Second verse", start: 21, end: 25 },
  ];
  const adjusted = adjustedCues(baseline, [
    { reference: "first", startOffsetSeconds: 0.75, endOffsetSeconds: -0.25 },
    { reference: "second", startOffsetSeconds: 1, endOffsetSeconds: 0.5 },
  ]);
  const sources = waveformReadingSources(sections);
  const preview = buildVerseReading(sources, adjusted, [2, 2]);
  assert.deepEqual(
    preview.sections.map(({ file, start, end }) => ({ file, start, end })),
    [
      { file: "reading-0", start: 103.75, end: 105.75 },
      { file: "reading-1", start: 42, end: 45.5 },
    ],
  );
  const selected = buildVerseReading(sources, [adjusted[1]], [2]);
  const waveform = readingTimeline(sections)[1];
  assert.equal(
    selected.sections[0].start,
    waveform.start + adjusted[1].start - waveform.timelineStart,
  );
  assert.equal(
    selected.sections[0].end,
    waveform.start + adjusted[1].end - waveform.timelineStart,
  );
  assert.equal(selected.duration, 3.5);
  assert.equal(selected.cues[0].start, 0);
});
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

test("selecting an overlapping verse moves both edges without changing its duration or other verses", () => {
  const cues = [
    { reference: "first", text: "First", start: 10, end: 22 },
    { reference: "second", text: "Second", start: 14, end: 19 },
    { reference: "third", text: "Third", start: 19, end: 25 },
  ];
  const original = structuredClone(cues);
  const selected = alignSelectedVerse(cues, 1, 60);
  assert.equal(selected.moved, true);
  assert.deepEqual(selected.cue, { ...cues[1], start: 22, end: 27 });
  assert.equal(
    selected.cue.end - selected.cue.start,
    cues[1].end - cues[1].start,
  );
  assert.deepEqual(cues, original);
  const next = alignSelectedVerse([cues[0], selected.cue, cues[2]], 2, 60);
  assert.deepEqual(next.cue, { ...cues[2], start: 27, end: 33 });
});

test("selection leaves the first verse and already aligned ranges untouched", () => {
  const cues = [
    { reference: "first", text: "First", start: 5, end: 10 },
    { reference: "second", text: "Second", start: 10, end: 15 },
    { reference: "third", text: "Third", start: 20, end: 25 },
  ];
  for (const index of [0, 1]) {
    assert.deepEqual(alignSelectedVerse(cues, index, 30), {
      cue: cues[index],
      moved: false,
      blocked: false,
    });
  }
  assert.equal(alignSelectedVerse([cues[2]], 0, 30).moved, false);
});

test("selection can use additional source context but never truncates a verse at the actual file end", () => {
  const cues = [
    { reference: "first", text: "First", start: 10, end: 25 },
    { reference: "second", text: "Second", start: 18, end: 23 },
  ];
  assert.deepEqual(alignSelectedVerse(cues, 1, 28), {
    cue: cues[1],
    moved: false,
    blocked: true,
  });
  const selected = alignSelectedVerse(cues, 1, 30);
  assert.deepEqual(selected.cue, { ...cues[1], start: 25, end: 30 });
  const offsets = [
    { reference: "second", startOffsetSeconds: 7, endOffsetSeconds: 7 },
  ];
  const adjusted = adjustedCues(cues, offsets);
  assert.deepEqual(adjusted[1], selected.cue);
  assert.deepEqual(applyVerseOffsets(cues, offsets, 30), adjusted);
  const rendered = buildVerseReading(
    [{ file: "chapter.mp3", start: 100, end: 130 }],
    adjusted,
    [2, 2],
  );
  assert.equal(rendered.sections[1].start, 125);
  assert.equal(rendered.sections[1].end, 130);
});

test("estimated verse gaps are closed without changing duration or neighboring cuts", () => {
  const cues = [
    { reference: "first", text: "First", start: 1, end: 12 },
    { reference: "second", text: "Second", start: 27, end: 33 },
    { reference: "third", text: "Third", start: 35, end: 40 },
  ];
  const original = structuredClone(cues);
  const aligned = alignSelectedVerse(cues, 1, 60);
  assert.deepEqual(aligned.cue, { ...cues[1], start: 12, end: 18 });
  assert.equal(aligned.moved, true);
  assert.deepEqual(cues, original);
  const offsets = [
    {
      reference: "second",
      startOffsetSeconds: -15,
      endOffsetSeconds: -15,
      manuallyAdjusted: false,
    },
  ];
  assert.deepEqual(adjustedCues(cues, offsets)[1], aligned.cue);
  assert.deepEqual(applyVerseOffsets(cues, offsets, 60)[1], aligned.cue);
});

test("automatic alignment respects manual cuts, including legacy and zero offsets, while explicit alignment is available", () => {
  const cues = [
    { reference: "first", text: "First", start: 1, end: 12 },
    { reference: "second", text: "Second", start: 27, end: 33 },
  ];
  const offset = {
    reference: "second",
    startOffsetSeconds: 0,
    endOffsetSeconds: 0,
  };
  assert.equal(verseHasManualCuts([], "second"), false);
  assert.equal(verseHasManualCuts([offset], "second"), true);
  assert.equal(
    verseHasManualCuts([{ ...offset, manuallyAdjusted: true }], "second"),
    true,
  );
  assert.equal(
    verseHasManualCuts([{ ...offset, manuallyAdjusted: false }], "second"),
    false,
  );
  assert.equal(alignSelectedVerse(cues, 1, 60, true).moved, false);
  assert.equal(alignSelectedVerse(cues, 1, 60, false).cue.start, 12);
  const overlap = [{ ...cues[0], end: 30 }, cues[1]];
  assert.equal(alignSelectedVerse(overlap, 1, 60, true).moved, false);
  assert.equal(alignSelectedVerse(overlap, 1, 60, false).cue.start, 30);
});

test("saved settings retain automatic versus manual alignment in both services", async () => {
  const { settingsSchema: dashboardSettings } = await import("./video-schema");
  const { settingsSchema: generatorSettings } =
    await import("../../../../tools/video-project-api/src/protocol");
  const offsets = [
    {
      reference: "first",
      startOffsetSeconds: 0,
      endOffsetSeconds: 1,
      manuallyAdjusted: true,
    },
    {
      reference: "second",
      startOffsetSeconds: -15,
      endOffsetSeconds: -15,
      manuallyAdjusted: false,
    },
  ];
  const saved = JSON.parse(
    JSON.stringify(dashboardSettings.parse({ verseOffsets: offsets })),
  );
  assert.deepEqual(generatorSettings.parse(saved).verseOffsets, offsets);
  assert.equal(verseHasManualCuts(saved.verseOffsets, "first"), true);
  assert.equal(verseHasManualCuts(saved.verseOffsets, "second"), false);
});
