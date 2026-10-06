import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";
import { config } from "./config.js";

test("backgrounds decode consecutive source frames, loop precisely, and hold only the final frame after EOF", { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-motion-"));
  try {
    const publicDir = path.join(root, "public");
    await fs.mkdir(publicDir);
    const source = path.join(publicDir, "motion.mp4");
    execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
      "nullsrc=s=128x228:r=24:d=0.5,geq=lum='20+12*N':cb=128:cr=128", "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", source]);
    const serveUrl = await bundle({ entryPoint: new URL("./remotion/test-fixtures/VideoMotion.tsx", import.meta.url).pathname,
      publicDir, outDir: path.join(root, "bundle") });
    const decode = (file: string) => execFileSync(config.ffmpegBin, ["-v", "error", "-i", file, "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 4 * 1024 * 1024 });
    const reference = decode(source);
    const frameSize = 128 * 228 * 3;
    assert.equal(reference.length / frameSize, 12);
    for (const loop of [false, true]) {
      const output = path.join(root, `${loop}.mp4`);
      await renderMedia({ serveUrl, composition: { id: "Motion", width: 128, height: 228, fps: 24, durationInFrames: 24,
        props: { src: "motion.mp4", loop }, defaultProps: { src: "motion.mp4", loop }, defaultCodec: null, defaultOutName: null,
        defaultVideoImageFormat: null, defaultPixelFormat: null, defaultProResProfile: null, defaultSampleRate: null },
        inputProps: { src: "motion.mp4", loop }, codec: "h264", crf: 10, outputLocation: output, concurrency: 2 });
      const actual = decode(output);
      assert.equal(actual.length / frameSize, 24);
      for (let frame = 0; frame < 24; frame++) {
        const expectedFrame = loop ? frame % 12 : Math.min(frame, 11);
        let error = 0;
        for (let byte = 0; byte < frameSize; byte++) error += Math.abs(actual[frame * frameSize + byte] - reference[expectedFrame * frameSize + byte]);
        assert.ok(error / frameSize < 4, `Frame ${frame} must match source ${expectedFrame} (${loop ? "loop" : "hold"}); average pixel error ${error / frameSize}`);
      }
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
