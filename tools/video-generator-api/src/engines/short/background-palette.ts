import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";

const execFileAsync = promisify(execFile);
export type RGB = [number, number, number];

/** Deterministic clustering keeps broad sky, foliage and earth tones, not compression noise. */
export function paletteFromPixels(pixels: Uint8Array): RGB[] {
  const samples: RGB[] = [];
  for (let i = 0; i + 2 < pixels.length; i += 12)
    samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  if (!samples.length)
    throw new Error("No pixels available for the background palette");
  const distance = (a: RGB, b: RGB) =>
    a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);
  const centers: RGB[] = [samples[Math.floor(samples.length / 2)]];
  while (centers.length < 4) {
    const farthest = samples.reduce((best, sample) =>
      Math.min(...centers.map((center) => distance(sample, center))) >
      Math.min(...centers.map((center) => distance(best, center)))
        ? sample
        : best,
    );
    centers.push([...farthest]);
  }
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centers.map(() => ({ rgb: [0, 0, 0], count: 0 }));
    for (const sample of samples) {
      let nearest = 0;
      for (let i = 1; i < centers.length; i++)
        if (distance(sample, centers[i]) < distance(sample, centers[nearest]))
          nearest = i;
      sample.forEach((value, channel) => {
        sums[nearest].rgb[channel] += value;
      });
      sums[nearest].count++;
    }
    sums.forEach((sum, index) => {
      if (sum.count)
        centers[index] = sum.rgb.map((value) => value / sum.count) as RGB;
    });
  }
  return centers.map((color) => {
    // Tint a light paper base with the sampled hue. Every channel stays above
    // 202, so even the darkest source produces a legible surface for dark ink.
    return color.map((value) => Math.round(202 + value * 0.2)) as RGB;
  });
}

export async function extractBackgroundPalette(
  file: string,
  duration: number,
): Promise<RGB[]> {
  console.log("Analyzing background colors...");
  const { stdout } = await execFileAsync(
    config.ffmpegBin,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-i",
      file,
      "-vf",
      `fps=${8 / duration},scale=64:96:force_original_aspect_ratio=increase,crop=64:96`,
      "-frames:v",
      "8",
      "-an",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 1024 * 1024 },
  );
  return paletteFromPixels(stdout);
}
