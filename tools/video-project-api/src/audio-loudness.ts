import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { loudnessTargetSchema } from "./loudness-schema.js";
import { audioWaveform } from "./audio-waveform.js";

const run = promisify(execFile);
const pending = new Map<string, Promise<string>>();
// Bound expensive analyses even when a book opens many waveforms at once.
let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

/** Lossless stereo derivatives keep the source timeline intact and are shared by all playback paths. */
export async function normalizeAudio(
  file: string,
  target: number,
  ffmpeg: string,
): Promise<string> {
  loudnessTargetSchema.parse(target);
  const stat = await fs.stat(file);
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        "loudness-v2",
        path.resolve(file),
        stat.size,
        stat.mtimeMs,
        stat.ctimeMs,
        target,
        ffmpeg,
      ]),
    )
    .digest("hex");
  const directory = path.join(os.tmpdir(), "veobible-loudness-v2");
  const output = path.join(directory, `${key}.flac`);
  if (
    await fs.stat(output).then(
      (s) => s.size > 44,
      () => false,
    )
  )
    return output;
  const existing = pending.get(key);
  if (existing) return existing;
  const task = slot(async () => {
    await fs.mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${key}-${randomUUID()}.flac`);
    const format = "aformat=channel_layouts=stereo,aresample=48000";
    const norm = `loudnorm=I=${target}:TP=-1:LRA=50`;
    const args = [
      "-hide_banner",
      "-nostdin",
      "-threads",
      "1",
      "-i",
      file,
      "-vn",
    ];
    try {
      const { stderr } = await run(
        ffmpeg,
        [
          ...args,
          "-af",
          `${format},${norm}:print_format=json`,
          "-f",
          "null",
          "-",
        ],
        { maxBuffer: 4 * 1024 * 1024 },
      );
      const block = stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s)?.[0];
      if (!block) throw new Error("Could not measure narration loudness");
      const measured = JSON.parse(block) as Record<string, string>;
      const fields = {
        measured_I: "input_i",
        measured_TP: "input_tp",
        measured_LRA: "input_lra",
        measured_thresh: "input_thresh",
        offset: "target_offset",
      };
      const measurable = Object.values(fields).every((key) =>
        Number.isFinite(Number(measured[key])),
      );
      // Silence stays silent. Linear normalization preserves dynamics where peak headroom permits;
      // FFmpeg falls back to dynamic normalization when the true-peak limit requires it.
      const filter = measurable
        ? `${format},${norm}:${Object.entries(fields)
            .map(([option, key]) => `${option}=${Number(measured[key])}`)
            .join(":")}:linear=true`
        : format;
      if (!measurable && measured.input_i !== "-inf")
        throw new Error("Invalid narration loudness measurement");
      await run(
        ffmpeg,
        [
          ...args,
          "-af",
          filter,
          "-ar",
          "48000",
          "-c:a",
          "flac",
          "-sample_fmt",
          "s32",
          "-y",
          temporary,
        ],
        { maxBuffer: 4 * 1024 * 1024 },
      );
      await fs.rename(temporary, output);
      // Prepare once alongside a newly normalized recording, without delaying playback.
      void audioWaveform(output, ffmpeg).catch((error) =>
        console.warn("Could not precompute audio waveform", error),
      );
      return output;
    } finally {
      await fs.rm(temporary, { force: true });
    }
  });
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

export async function normalizeSections<T extends { file: string }>(
  sections: T[],
  target: number,
  ffmpeg: string,
): Promise<T[]> {
  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      file: await normalizeAudio(section.file, target, ffmpeg),
    })),
  );
}
