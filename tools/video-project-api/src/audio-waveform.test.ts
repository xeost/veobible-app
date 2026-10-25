import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { audioWaveform } from "./audio-waveform.js";
import { decodeWaveform, encodeWaveform } from "./waveform-format.js";

const run = promisify(execFile);
test("waveform sidecars preserve stereo peaks, deduplicate work, survive reuse and invalidate changed recordings", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "waveform-test-"));
  try {
    const source = path.join(directory, "audio.wav");
    // Opposite-polarity stereo must not cancel, and a one-sample peak must survive.
    const pcm = Buffer.alloc(48000 * 2 * 4);
    pcm.writeFloatLE(0.75, 4);
    pcm.writeFloatLE(-0.5, 96 * 4);
    await fs.writeFile(path.join(directory, "input.pcm"), pcm);
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "f32le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-i",
      path.join(directory, "input.pcm"),
      "-c:a",
      "pcm_f32le",
      source,
    ]);
    const results = await Promise.all(
      Array.from({ length: 4 }, () => audioWaveform(source, "ffmpeg")),
    );
    assert.ok(
      results.every(
        (result) =>
          result.file === results[0].file && result.etag === results[0].etag,
      ),
    );
    const bytes = await fs.readFile(results[0].file);
    const peaks = decodeWaveform(Uint8Array.from(bytes).buffer);
    assert.equal(peaks.duration, 1);
    assert.equal(peaks.interval, 0.001);
    assert.equal(peaks.amplitudes.length, 1000);
    assert.equal(peaks.amplitudes[0], 0.75);
    assert.equal(peaks.amplitudes[1], 0.5);
    assert.equal(peaks.amplitudes[2], 0);
    // An unavailable calculator still serves a valid existing sidecar after the task finished.
    assert.deepEqual(await audioWaveform(source, "missing-ffmpeg"), results[0]);
    assert.ok(bytes.length < pcm.length / 50);
    await fs.writeFile(results[0].file, "corrupted");
    const repaired = await audioWaveform(source, "ffmpeg");
    assert.deepEqual(await fs.readFile(repaired.file), bytes);
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=220:duration=0.5",
      "-y",
      source,
    ]);
    const changed = await audioWaveform(source, "ffmpeg");
    assert.notEqual(changed.etag, repaired.etag);
    assert.notEqual(changed.file, repaired.file);
    await assert.rejects(
      audioWaveform(path.join(directory, "missing.wav"), "ffmpeg"),
    );
    const invalid = path.join(directory, "invalid.wav");
    await fs.writeFile(invalid, "invalid audio");
    await assert.rejects(audioWaveform(invalid, "ffmpeg"));
    assert.ok(
      !(await fs.readdir(directory)).some((name) => name.endsWith(".tmp")),
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("binary waveforms reject truncated, unsupported and non-finite data", () => {
  const original = encodeWaveform({
    duration: 0.002,
    interval: 0.001,
    amplitudes: new Float32Array([0.1, 0.9]),
  });
  assert.deepEqual(encodeWaveform(decodeWaveform(original)), original);
  for (const size of [0, 4, 23, 25, 28])
    assert.throws(() => decodeWaveform(original.slice(0, size)));
  const unsupported = original.slice(0);
  new DataView(unsupported).setUint32(4, 2, true);
  assert.throws(() => decodeWaveform(unsupported));
  for (const value of [NaN, Infinity, -1]) {
    const invalid = original.slice(0);
    new DataView(invalid).setFloat32(24, value, true);
    assert.throws(() => decodeWaveform(invalid));
  }
});
