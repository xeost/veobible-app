import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createBoomerang } from "./boomerang.js";
const execute = promisify(execFile);

test("boomerangs play all frames forward then backward without reversing or duplicating the clip audio", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-boomerang-"));
  const run = async (args: string[]) => { await execute("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", ...args]); };
  try {
    const source = path.join(directory, "source.mp4");
    const raw = path.join(directory, "frames.rgb");
    await fs.writeFile(raw, Buffer.concat([[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]].map((color) => {
      const pixels = Buffer.alloc(64 * 64 * 3);
      for (let offset = 0; offset < pixels.length; offset += 3) pixels.set(color, offset);
      return pixels;
    })));
    await run(["-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", "64x64", "-framerate", "4", "-i", raw, "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source]);
    const sourceInfo = JSON.parse((await execute("ffprobe", ["-v", "error", "-show_streams", "-of", "json", source])).stdout);
    assert.equal(Number(sourceInfo.streams.find((stream: { codec_type: string }) => stream.codec_type === "video").nb_frames), 4);
    const output = path.join(directory, "boomerang.mp4");
    await createBoomerang(source, output, { width: 64, height: 64, frameRate: "4/1", preserveAudio: true }, run);
    const { stdout } = await execute("ffmpeg", ["-v", "error", "-i", output, "-map", "0:v:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { encoding: "buffer" });
    const frameBytes = 64 * 64 * 3;
    assert.equal(stdout.length / frameBytes, 8);
    const colors = Array.from({ length: 8 }, (_, frame) => {
      const offset = frame * frameBytes + (32 * 64 + 32) * 3;
      const [r, g, b] = stdout.subarray(offset, offset + 3);
      if (r > 180 && g > 180 && b < 50) return "yellow";
      if (r > 180 && g < 50 && b < 50) return "red";
      if (g > 180 && r < 50 && b < 50) return "green";
      if (b > 180 && r < 50 && g < 50) return "blue";
      throw new Error(`Unexpected pixel ${r},${g},${b}`);
    });
    assert.deepEqual(colors, ["red", "green", "blue", "yellow", "yellow", "blue", "green", "red"]);
    const audio = async (file: string) => (await execute("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-c:a", "copy", "-f", "adts", "pipe:1"], { encoding: "buffer" })).stdout;
    assert.deepEqual(await audio(output), await audio(source));
    const trimmed = path.join(directory, "trimmed.mp4");
    await createBoomerang(source, trimmed, { width: 64, height: 64, frameRate: "4/1", preserveAudio: true, videoEndSeconds: 0.75 }, run);
    const trimmedFrames = (await execute("ffmpeg", ["-v", "error", "-i", trimmed, "-map", "0:v:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { encoding: "buffer" })).stdout;
    assert.equal(trimmedFrames.length / frameBytes, 6);
    // The excluded last picture never appears, while the narration remains intact.
    for (const frame of [2, 3]) {
      const offset = frame * frameBytes + (32 * 64 + 32) * 3;
      assert.ok(trimmedFrames[offset + 2] > 180);
      assert.ok(trimmedFrames[offset] < 50);
    }
    assert.deepEqual(await audio(trimmed), await audio(source));
    const silent = path.join(directory, "silent.mp4");
    await createBoomerang(source, silent, { width: 64, height: 64, frameRate: "4/1" }, run);
    const info = JSON.parse((await execute("ffprobe", ["-v", "error", "-show_streams", "-of", "json", silent])).stdout);
    assert.ok(!info.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio"));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
