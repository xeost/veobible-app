import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeAudio, normalizeSections } from "./audio-loudness.js";
import { prepareTrimmedVoice } from "./voice-trim.js";
const run = promisify(execFile);
async function measure(file: string) {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-i",
    file,
    "-af",
    "loudnorm=print_format=json",
    "-f",
    "null",
    "-",
  ]);
  const loudness = JSON.parse(stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s)![0]);
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  return {
    integrated:
      loudness.input_i === "-inf" ? -Infinity : Number(loudness.input_i),
    peak: Number(loudness.input_tp),
    duration: Number(stdout),
  };
}
test("all narration derivatives meet both selectable targets, preserve timing and originals, and invalidate their cache", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "loudness-test-"));
  const cached = new Set<string>();
  try {
    const source = path.join(directory, "recording.wav");
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=4",
      "-af",
      "volume=0.15",
      source,
    ]);
    const original = await fs.readFile(source);
    for (const target of [-14, -16]) {
      const files = await Promise.all([
        normalizeAudio(source, target, "ffmpeg"),
        normalizeAudio(source, target, "ffmpeg"),
      ]);
      assert.equal(files[0], files[1]);
      const output = files[0];
      cached.add(output);
      const measured = await measure(output);
      assert.ok(
        Math.abs(measured.integrated - target) < 0.2,
        JSON.stringify(measured),
      );
      assert.ok(measured.peak <= -0.9);
      assert.ok(Math.abs(measured.duration - 4) < 0.001);
      assert.equal(await normalizeAudio(source, target, "ffmpeg"), output);
      const sections = await normalizeSections(
        [
          { file: source, start: 0.1, end: 1.5 },
          { file: source, start: 2, end: 3, generatedVoice: true },
        ],
        target,
        "ffmpeg",
      );
      assert.deepEqual(
        sections.map((s) => s.file),
        [output, output],
      );
      assert.equal(sections[1].start, 2);
      const voice = await prepareTrimmedVoice(
        source,
        { startSeconds: 1, endSeconds: 3 },
        directory,
        "intro",
        { ffmpegBin: "ffmpeg", ffprobeBin: "ffprobe", loudnessTarget: target },
      );
      const trimmed = await measure(voice);
      assert.ok(Math.abs(trimmed.integrated - target) < 0.2);
      assert.ok(Math.abs(trimmed.duration - 2) < 0.001);
    }
    assert.deepEqual(await fs.readFile(source), original);
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:duration=4",
      "-y",
      source,
    ]);
    const revised = await normalizeAudio(source, -14, "ffmpeg");
    assert.ok(!cached.has(revised));
    cached.add(revised);
    await assert.rejects(normalizeAudio(source, -18, "ffmpeg"));
    const peaked = path.join(directory, "peaked.wav");
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "aevalsrc=if(lt(mod(t\\,2)\\,0.001)\\,0.95\\,0.01*sin(2*PI*440*t)):s=48000:d=12",
      peaked,
    ]);
    const limited = await normalizeAudio(peaked, -14, "ffmpeg");
    cached.add(limited);
    const limitedMeasurement = await measure(limited);
    assert.ok(
      limitedMeasurement.peak <= -0.9,
      JSON.stringify(limitedMeasurement),
    );
    assert.ok(
      Math.abs(limitedMeasurement.integrated + 14) < 0.5,
      JSON.stringify(limitedMeasurement),
    );
    assert.ok(Math.abs(limitedMeasurement.duration - 12) < 0.001);
    const silent = path.join(directory, "silent.wav");
    await run("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=mono",
      "-t",
      "1",
      silent,
    ]);
    const silence = await normalizeAudio(silent, -14, "ffmpeg");
    cached.add(silence);
    const measurement = await measure(silence);
    assert.equal(measurement.integrated, -Infinity);
    assert.equal(measurement.duration, 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
    await Promise.all([...cached].map((file) => fs.rm(file, { force: true })));
  }
});
