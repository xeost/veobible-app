import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { paletteFromPixels, type RGB } from "./background-palette.js";
import { createStageGraphics } from "./motion-design.js";
import { config } from "./config.js";

test("background palette preserves diverse hues and keeps light tones for dark text", () => {
  const source: RGB[] = [[220, 100, 30], [30, 180, 70], [40, 100, 230], [230, 210, 160]];
  const pixels = Uint8Array.from(source.flatMap(color => Array.from({ length: 100 }, () => color).flat()));
  const colors = paletteFromPixels(pixels);
  assert.deepEqual(colors, paletteFromPixels(pixels));
  assert.equal(new Set(colors.map(color => color.join(","))).size, 4);
  assert.ok(colors.some(([r, g, b]) => r > g && g > b));
  assert.ok(colors.some(([r, g, b]) => g > r && g > b));
  assert.ok(colors.some(([r, g, b]) => b > r && b > g));
  for (const [r, g, b] of colors) {
    assert.ok(Math.min(r, g, b) >= 202);
    assert.ok(Math.max(r, g, b) <= 253);
  }
  assert.throws(() => paletteFromPixels(new Uint8Array()), /No pixels/);
  assert.equal(new Set(paletteFromPixels(Uint8Array.from(Array(20).fill([80, 100, 90]).flat())).map(color => color.join(","))).size, 1);
});

test("reading shading moves and covers the frame with softer top and bottom edges", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "veobible-gradient-test-"));
  try {
    const graphics = await createStageGraphics({
      width: 160, height: 284, rate: "2", staging: root,
      intro: { title: "Daily word", reference: "John 3:14", version: "Test" },
      outro: { title: "Follow", highlight: "for more", channel: "VeoBible", social: [], website: "veobible.com" },
      cues: [], introLength: 2, outroLength: 2, readingLength: 32, readingSilence: 1,
      readingPalette: [[253, 207, 202], [202, 245, 207], [202, 207, 253], [245, 232, 202]]
    });
    const script = path.join(root, "filter.txt");
    await fs.writeFile(script, `[0:v]setpts=PTS-STARTPTS[v1base];${graphics.reading.join(";")}`);
    const frames = execFileSync(config.ffmpegBin, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=160x284:r=2:d=32", "-/filter_complex", script, "-map", "[v1]", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], { maxBuffer: 12 * 1024 * 1024 });
    const pixel = (second: number, x: number, y: number) => {
      const offset = ((second * 2 * 160 * 284) + y * 160 + x) * 3;
      return [...frames.subarray(offset, offset + 3)];
    };
    const early = pixel(3, 80, 110), later = pixel(24, 80, 110);
    assert.ok(early.some((value, i) => Math.abs(value - later[i]) >= 5), `${early} -> ${later}`);
    assert.ok(Math.min(...early, ...later) > 115, "Shading keeps a black background light behind text");
    assert.ok(Math.max(...early, ...later) < 160, "Shading lets the background show through");
    assert.ok(pixel(3, 80, 205).every(value => value > 115), "Footer sits inside the light surface");
    const footerSurface = Math.max(...pixel(3, 80, 205));
    let darkFooterPixels = 0;
    for (let y = 200; y < 208; y++) for (let x = 17; x < 70; x++) {
      if (Math.max(...pixel(3, x, y)) < footerSurface - 20) darkFooterPixels++;
    }
    assert.ok(darkFooterPixels > 3, "Footer uses dark ink");
    for (const edge of [pixel(3, 80, 0), pixel(3, 80, 283)]) {
      assert.ok(edge.every(value => value > 15 && value < 60), "Both edges retain a faint tint");
    }
    assert.ok(pixel(3, 80, 30).every((value, i) => value > pixel(3, 80, 0)[i] && value < early[i]), "Top gradient grows toward the text");
    assert.ok(pixel(3, 80, 250).every((value, i) => value > pixel(3, 80, 283)[i] && value < pixel(3, 80, 205)[i]), "Bottom gradient fades toward the edge");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
