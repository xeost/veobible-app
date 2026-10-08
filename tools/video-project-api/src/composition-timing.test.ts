import { test } from "node:test";
import assert from "node:assert/strict";
import { READING_END_SILENCE, OUTRO_NARRATION_DELAY, LONG_OUTRO_END_SILENCE, readingPadding } from "./composition-timing.js";

test("the final word has a pause before the dissolve and narration starts after the dissolve", () => {
  const leadingSilence = 1;
  const readingDuration = 13.125;
  const transitionDuration = 0.5;
  for (const fps of [24, 25, 30, 60]) {
    const readingLength = readingDuration + readingPadding({ readingSilence: leadingSilence, readingEndSilence: READING_END_SILENCE });
    const lastWord = Math.round((leadingSilence + readingDuration) * fps);
    const readingEnd = Math.round(readingLength * fps);
    const dissolveStart = readingEnd - Math.round(transitionDuration * fps);
    const narrationStart = dissolveStart + Math.round(OUTRO_NARRATION_DELAY * fps);
    const tolerance = 1 / fps;
    assert.ok(Math.abs((dissolveStart - lastWord) / fps - 1) <= tolerance);
    assert.ok(Math.abs((narrationStart - readingEnd) / fps - 0.25) <= tolerance);
    // The final narration fits completely, with the existing two-second closing pause.
    const voiceDuration = 4.2;
    const outroFrames = Math.round((voiceDuration + OUTRO_NARRATION_DELAY + 2) * fps);
    const voiceEnd = Math.round(OUTRO_NARRATION_DELAY * fps) + Math.round(voiceDuration * fps);
    assert.ok(Math.abs((outroFrames - voiceEnd) / fps - 2) <= tolerance);
  }
});

test("preview padding preserves exact reading cuts with both new and older prepared responses", () => {
  assert.equal(readingPadding({ readingSilence: 1, readingEndSilence: READING_END_SILENCE }), 2.5);
  assert.equal(readingPadding({ readingSilence: 1 }), 2);
  const duration = 7.375;
  const props = { readingSilence: 1, readingEndSilence: READING_END_SILENCE };
  const length = duration + readingPadding(props);
  assert.equal(length - readingPadding(props), duration);
});

test("long outros leave seven seconds after narration and retain end-screen content", async () => {
  const { outroAnimationPhase, phaseAlpha, phaseY } = await import("./engines/long/remotion/animation.js");
  for (const fps of [24, 25, 30, 60]) {
    const voiceDuration = 4.2;
    const length = voiceDuration + OUTRO_NARRATION_DELAY + LONG_OUTRO_END_SILENCE;
    const frames = Math.round(length * fps);
    const voiceEnd = Math.round(OUTRO_NARRATION_DELAY * fps) + Math.round(voiceDuration * fps);
    assert.ok(Math.abs((frames - voiceEnd) / fps - 7) <= 1 / fps);
    for (const delay of [0, 0.16, 0.55, 0.7, 1.2, 1.4]) {
      const phase = outroAnimationPhase(length, delay);
      assert.equal(phaseAlpha(0, phase), 0);
      for (const frame of [frames - fps, frames - 1]) {
        assert.equal(phaseAlpha(frame / fps, phase), 1);
        assert.equal(phaseY(frame / fps, phase, 595, 30), 595);
      }
    }
  }
});
