import { test } from "node:test";
import assert from "node:assert/strict";
import { detectedYouTubeId } from "./social-video-ids";
test("editor enables its YouTube link only for a valid detected video ID", () => {
  assert.equal(
    detectedYouTubeId('{"youtube":"abcdefghijk","instagram":"other"}'),
    "abcdefghijk",
  );
  for (const value of [
    undefined,
    null,
    "{}",
    "broken",
    "null",
    "[]",
    '{"youtube":123}',
    '{"youtube":"https://evil.test"}',
    '{"youtube":"abcdefghijk?x"}',
  ])
    assert.equal(detectedYouTubeId(value), null);
});
