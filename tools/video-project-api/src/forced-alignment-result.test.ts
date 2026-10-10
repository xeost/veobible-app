import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alignmentSignature,
  mergeAlignment,
  type AlignmentResult,
} from "./forced-alignment-result.js";
import { expandReadingContext } from "./reading-timeline.js";

const result: AlignmentResult = {
  signature: "test",
  model: "test",
  offsets: [
    { reference: "manual", startOffsetSeconds: 1, endOffsetSeconds: 2 },
    { reference: "legacy", startOffsetSeconds: 1, endOffsetSeconds: 2 },
    { reference: "auto", startOffsetSeconds: 1, endOffsetSeconds: 2 },
    { reference: "new", startOffsetSeconds: -1, endOffsetSeconds: 0 },
  ],
  padding: [{ sectionIndex: 0, beforeSeconds: 3, afterSeconds: 5 }],
};

test("alignment preserves manual and legacy cuts, replaces automatic cuts, keeps other blocks and merges padding", () => {
  const manual = {
    reference: "manual",
    startOffsetSeconds: 0.1,
    endOffsetSeconds: 0.2,
    manuallyAdjusted: true,
  };
  const legacy = {
    ...manual,
    reference: "legacy",
    manuallyAdjusted: undefined,
  };
  const untouched = { ...manual, reference: "other" };
  const settings = {
    volumeMultiplier: 1.4,
    verseOffsets: [
      manual,
      legacy,
      untouched,
      { ...manual, reference: "auto", manuallyAdjusted: false },
    ],
    readingSectionPadding: [
      { sectionIndex: 0, beforeSeconds: 8, afterSeconds: 1 },
    ],
  };
  const merged = mergeAlignment(settings, result, "id");
  assert.equal(merged.volumeMultiplier, 1.4);
  assert.equal(merged.alignmentJobId, "id");
  assert.deepEqual(merged.verseOffsets.slice(0, 3), [
    manual,
    legacy,
    untouched,
  ]);
  assert.equal(
    merged.verseOffsets.find((v) => v.reference === "auto")?.startOffsetSeconds,
    1,
  );
  assert.equal(
    merged.verseOffsets.find((v) => v.reference === "new")?.manuallyAdjusted,
    false,
  );
  assert.deepEqual(merged.readingSectionPadding, [
    { sectionIndex: 0, beforeSeconds: 8, afterSeconds: 5 },
  ]);
  assert.deepEqual(settings.readingSectionPadding[0].afterSeconds, 1);
});

test("expanding an earlier block preserves source coordinates and per-verse offsets in later blocks", () => {
  const sections = [
    { start: 10, end: 20 },
    { start: 30, end: 40 },
  ];
  const cues = [
    { start: 0, end: 10 },
    { start: 10, end: 20 },
  ];
  const expanded = expandReadingContext(
    sections,
    cues,
    [50, 60],
    [{ sectionIndex: 0, beforeSeconds: 3, afterSeconds: 5 }],
  );
  const offset = 1;
  const secondTimelineStart =
    expanded.sections[0].end - expanded.sections[0].start;
  assert.equal(
    expanded.sections[1].start +
      expanded.cues[1].start +
      offset -
      secondTimelineStart,
    31,
  );
});

test("alignment identity ignores JSON insertion order but rejects changed version, passage and passage trim", () => {
  const input = {
    kind: "long",
    version: { id: "kjv", locale: "en" },
    passage: { start: { verse: 1, chapter: 2 }, id: "test" },
    settings: { passageOffsets: { startSeconds: 0, endSeconds: 0 } },
  };
  assert.equal(
    alignmentSignature(input),
    alignmentSignature({
      ...input,
      passage: { id: "test", start: { chapter: 2, verse: 1 } },
    }),
  );
  assert.notEqual(
    alignmentSignature(input),
    alignmentSignature({ ...input, version: { id: "asv", locale: "en" } }),
  );
  assert.notEqual(
    alignmentSignature(input),
    alignmentSignature({
      ...input,
      settings: { passageOffsets: { startSeconds: 2, endSeconds: 0 } },
    }),
  );
});

test("review flags update only analyzed verses and exclude preserved manual cuts", () => {
  const merged = mergeAlignment(
    {
      verseOffsets: [
        {
          reference: "manual",
          startOffsetSeconds: 0,
          endOffsetSeconds: 0,
          manuallyAdjusted: true,
        },
      ],
      readingSectionPadding: [],
      alignmentReviewReferences: ["other", "auto"],
    },
    { ...result, reviewReferences: ["manual", "new"] },
    "job",
  );
  assert.deepEqual(merged.alignmentReviewReferences, ["other", "new"]);
});
