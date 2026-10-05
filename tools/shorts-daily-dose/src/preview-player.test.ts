import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { startPreviewPlayback, type PreviewPlayback } from "./preview-player.js";
import { config } from "./config.js";

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

test("native audio-engine pause freezes the real playback position and resumes without restarting", { timeout: 15000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-native-player-"));
  let playback: PreviewPlayback | undefined;
  try {
    const file = path.join(root, "tone.wav");
    execFileSync(config.ffmpegBin, ["-v", "error", "-f", "lavfi", "-i", "sine=duration=2", file]);
    playback = await startPreviewPlayback(file, ["--ao=null", "--ao-null-buffer=0.04"]);
    await wait(150);
    assert.ok(playback.position() > 0.05);
    const before = playback.position();
    const pauseStarted = performance.now();
    await playback.pause();
    assert.ok(performance.now() - pauseStarted < 250, "Pause responds promptly, including its short gain ramp");
    const paused = playback.position();
    assert.ok(paused >= before - 0.05 && paused - before < 0.25);
    await wait(200);
    assert.ok(Math.abs(playback.position() - paused) < 0.002, "No samples advance while paused");
    await playback.resume();
    await wait(120);
    assert.ok(playback.position() > paused + 0.05, "Resume continues from the paused position");
    await playback.pause();
    const secondPause = playback.position();
    await wait(100);
    assert.equal(playback.position(), secondPause);
    playback.stop();
    await playback.finished;
    await assert.rejects(startPreviewPlayback(path.join(root, "missing.wav"), ["--ao=null"]), /Audio playback failed|did not load/);
  } finally {
    playback?.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});
