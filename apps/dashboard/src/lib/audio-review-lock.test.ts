import { test } from "node:test";
import assert from "node:assert/strict";
import { audioReviewLocked } from "./audio-review-lock";

test("review remains available in other chapters during queued or running audio work", () => {
  assert.equal(audioReviewLocked(2, true, [{ chapter: 1 }]), false);
  assert.equal(audioReviewLocked(1, true, [{ chapter: 1 }]), true);
  assert.equal(
    audioReviewLocked(2, true, [{ chapter: 1 }, { chapter: 2 }]),
    true,
  );
  assert.equal(audioReviewLocked(2, true, []), true);
  assert.equal(audioReviewLocked(2, true, [{}]), true);
  assert.equal(audioReviewLocked(2, false, []), false);
});
