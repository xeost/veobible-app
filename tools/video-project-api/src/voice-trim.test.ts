import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prepareTrimmedVoice } from "./voice-trim.js";
const run = promisify(execFile);
const binaries = { ffmpegBin: "ffmpeg", ffprobeBin: "ffprobe" };
async function duration(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return Number(stdout.trim());
}
test("voice cuts remove both audio ends without modifying original or shared recordings", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "voice-trim-"));
  try {
    const source = path.join(directory, "shared.wav");
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      source,
    ]);
    const original = await fs.readFile(source);
    assert.equal(
      await prepareTrimmedVoice(
        source,
        undefined,
        directory,
        "intro",
        binaries,
      ),
      source,
    );
    const selected = await prepareTrimmedVoice(
      source,
      { startSeconds: 0.2, endSeconds: 0.65 },
      directory,
      "intro",
      binaries,
    );
    assert.ok(Math.abs((await duration(selected)) - 0.45) < 0.001);
    const chapter = await prepareTrimmedVoice(
      source,
      { startSeconds: 0.3, endSeconds: 5 },
      directory,
      "chapter-0",
      binaries,
    );
    assert.ok(Math.abs((await duration(chapter)) - 0.7) < 0.001);
    assert.deepEqual(await fs.readFile(source), original);
    await assert.rejects(
      prepareTrimmedVoice(
        source,
        { startSeconds: 2, endSeconds: 3 },
        directory,
        "outro",
        binaries,
      ),
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
