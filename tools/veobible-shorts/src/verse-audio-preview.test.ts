import assert from "node:assert/strict";
import test from "node:test";
import { playbackPercent, replayLastFive, verseAtTime } from "./verse-audio-preview.js";
import { moveVerseBoundary } from "./timing-model.js";

test("fragment progress and five-second replay use passage-relative positions", () => {
  assert.equal(playbackPercent(12, 10, 14), 50);
  assert.equal(playbackPercent(14, 10, 14), 100);
  assert.equal(playbackPercent(14, 10, 19), 400 / 9);
  assert.equal(playbackPercent(9, 10, 14), 0);
  assert.equal(playbackPercent(20, 10, 14), 100);
  assert.equal(replayLastFive(18.25, 10), 13.25);
  assert.equal(replayLastFive(12, 10), 10);
});

test("the fragment tail and live verse text follow the newly assigned ending", () => {
  const original = [
    { reference: "John 1:1", text: "First verse", start: 0, end: 10 },
    { reference: "John 1:2", text: "Next verse", start: 10, end: 20 }
  ];
  const edited = moveVerseBoundary(original, 0, "end", 8.125, 20);
  const fragmentEnd = Math.min(20, edited[0].end + 1);
  assert.equal(replayLastFive(fragmentEnd, 0), 4.125);
  assert.equal(verseAtTime(edited, 8.124)?.reference, "John 1:1");
  assert.equal(verseAtTime(edited, 8.125)?.reference, "John 1:2");
  assert.equal(verseAtTime(edited, fragmentEnd)?.reference, "John 1:2");
  assert.equal(verseAtTime(original, 8.125)?.reference, "John 1:1");
  assert.equal(verseAtTime(edited, 20), undefined);
});
