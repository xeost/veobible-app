import { test } from "node:test";
import assert from "node:assert/strict";
import { stopPreviewPlayback } from "./preview-playback";

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
