import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { config } from "./config.js";
import { renderShortVideo } from "./video.js";

test("Remotion renders all external video and audio assets, including repeated renders with a cached bundle", { timeout: 60000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-remotion-render-"));
  const videos = path.join(root, "media # español");
  const sourceAudio = path.join(root, "audio files");
  try {
    await fs.mkdir(videos);
    await fs.mkdir(sourceAudio);
    for (const [name, color] of [["0-intro.mp4", "red"], ["0-outro.mp4", "blue"], ["bg-0.mp4", "green"]]) {
      execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${color}:size=128x228:rate=24:duration=0.5`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", path.join(videos, name)]);
    }
    const reading = path.join(sourceAudio, "chapter.mp3");
    const intro = path.join(sourceAudio, "intro.wav");
    const outro = path.join(sourceAudio, "outro.wav");
    for (const file of [reading, intro, outro]) execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=660:duration=0.4", "-y", file]);
    const originalIntro = await fs.readFile(intro);
    for (let render = 0; render < 2; render++) {
      const output = path.join(root, `short-${render}.mp4`);
      const result = await renderShortVideo(output, [{ file: reading, start: 0, end: 0.2 }, { file: reading, start: 0.2, end: 0.4 }], videos,
        { title: "Daily word", reference: "John 3:16", version: "Test" },
        { title: "Follow", highlight: "for more", channel: "VeoBible", social: [], website: "veobible.com" },
        [{ reference: "John 3:16", text: "Verse text", start: 0, end: 0.4 }], { intro, outro, mode: "voice" });
      const info = JSON.parse(execFileSync(config.ffprobeBin, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate", "-of", "json", output], { encoding: "utf8" }));
      assert.ok(info.streams.some((stream: { codec_type: string; width: number; height: number }) => stream.codec_type === "video" && stream.width === 128 && stream.height === 228));
      assert.equal(info.streams.find((stream: { codec_type: string }) => stream.codec_type === "video").r_frame_rate, "24/1", "The render preserves source FPS rather than converting to 30 FPS");
      assert.ok(info.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio"));
      assert.ok(Math.abs(Number(info.format.duration) - result.duration) < 0.15);
      const samples = execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-i", output, "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], { maxBuffer: 512 * 1024 });
      let peak = 0;
      for (let byte = 0; byte < samples.length; byte += 2) peak = Math.max(peak, Math.abs(samples.readInt16LE(byte)));
      assert.ok(peak > 500, "The served audio assets are decoded into the final video");
    }
    assert.deepEqual(await fs.readFile(intro), originalIntro);
    assert.equal((await fs.readdir(root)).some(name => name.startsWith(".video-")), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
