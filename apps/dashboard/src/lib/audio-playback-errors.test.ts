import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasMediaPlaybackError,
  isPlaybackInterruption,
} from "./audio-playback-errors";

test("pausing or replacing pending playback is not a playback failure", () => {
  assert.equal(
    isPlaybackInterruption(new DOMException("Playback paused", "AbortError")),
    true,
  );
  // Errors from a different window need not share the DOMException prototype.
  assert.equal(isPlaybackInterruption({ name: "AbortError" }), true);
  assert.equal(isPlaybackInterruption(null), false);
  assert.equal(isPlaybackInterruption(undefined), false);
  assert.equal(isPlaybackInterruption(new Error("Network failure")), false);
  for (const name of ["NotAllowedError", "NotSupportedError"])
    assert.equal(
      isPlaybackInterruption(new DOMException("Failed", name)),
      false,
    );
});

test("media events only report actual network, decoding or source failures", () => {
  assert.equal(hasMediaPlaybackError({ error: null }), false);
  assert.equal(hasMediaPlaybackError({ error: { code: 1 } }), false);
  for (const code of [2, 3, 4])
    assert.equal(hasMediaPlaybackError({ error: { code } }), true);
});
