import { test } from "node:test";
import assert from "node:assert/strict";
import { applyReadingPlaybackSpeed } from "./reading-playback";

test("waveform speed survives media loading and preserves source trim positions", () => {
  const player = {
    defaultPlaybackRate: 1,
    playbackRate: 1,
    preservesPitch: false,
    currentTime: 42,
  };
  applyReadingPlaybackSpeed(player, 3);
  // A new media resource adopts the default rate when it loads.
  player.playbackRate = player.defaultPlaybackRate;
  assert.equal(player.playbackRate, 3);
  assert.equal(player.preservesPitch, true);
  assert.equal(player.currentTime, 42);
  applyReadingPlaybackSpeed(player, 0.5);
  assert.equal(player.playbackRate, 0.5);
  assert.equal(player.defaultPlaybackRate, 0.5);
  assert.equal(player.currentTime, 42);
});

test("restarting after a seek refreshes the engine even if the exposed playback rate did not change", () => {
  let exposedRate = 3;
  let actualRate = 1;
  const player = {
    defaultPlaybackRate: 3,
    preservesPitch: true,
    get playbackRate() {
      return exposedRate;
    },
    set playbackRate(value: number) {
      if (value !== exposedRate) actualRate = value;
      exposedRate = value;
    },
  };
  applyReadingPlaybackSpeed(player, 3, true);
  assert.equal(actualRate, 3);
  assert.equal(player.playbackRate, 3);
  assert.equal(player.defaultPlaybackRate, 3);
  actualRate = 1;
  applyReadingPlaybackSpeed(player, 3, true);
  assert.equal(actualRate, 3);
});
