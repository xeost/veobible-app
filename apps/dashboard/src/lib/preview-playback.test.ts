import { test } from "node:test";
import assert from "node:assert/strict";
import { previewDurationInFrames, stopPreviewPlayback } from "./preview-playback";

test("section players ignore a full-video duration returned by the service", () => {
  const preview = {
    fps: 30,
    durationInFrames: 3000,
    props: { introLength: 6.5, outroLength: 8.2, readingLength: 70 },
  };
  assert.equal(previewDurationInFrames(preview, "intro"), 195);
  assert.equal(previewDurationInFrames(preview, "outro"), 246);
  assert.equal(previewDurationInFrames(preview, "reading"), 2100);
  assert.equal(previewDurationInFrames(preview), 3000);
});

test("preview shutdown stops the player and releases every scoped media source, including pending playback", () => {
  const calls: string[] = [];
  const media = (name: string) => ({
    muted: false,
    pause: () => calls.push(`${name}:pause`),
    removeAttribute: (attribute: string) =>
      calls.push(`${name}:remove:${attribute}`),
    load: () => calls.push(`${name}:cancel-load`),
  });
  const audio = media("audio");
  const video = media("video");
  const unrelated = media("other-project");
  stopPreviewPlayback(
    {
      pause: () => calls.push("player:pause"),
      mute: () => calls.push("player:mute"),
    },
    [audio, video],
  );
  assert.deepEqual(calls, [
    "player:pause",
    "player:mute",
    "audio:pause",
    "audio:remove:src",
    "audio:cancel-load",
    "video:pause",
    "video:remove:src",
    "video:cancel-load",
  ]);
  assert.equal(audio.muted, true);
  assert.equal(video.muted, true);
  assert.equal(unrelated.muted, false);
});

test("closing during preparation or after an earlier shutdown remains safe", () => {
  assert.doesNotThrow(() => stopPreviewPlayback(null, []));
});

test("full preview duration follows the edited reading timeline and both transitions", () => {
  const preview = {
    fps: 30, durationInFrames: 3000,
    props: { introLength: 6.5, outroLength: 8.2, readingLength: 12.125, transitionDuration: 0.5 },
  };
  assert.equal(previewDurationInFrames(preview), 195 + 246 + 364 - 30);
  assert.equal(previewDurationInFrames(preview, "reading"), 364);
});
