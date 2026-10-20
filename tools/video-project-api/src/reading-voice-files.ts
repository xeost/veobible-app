import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
const run = promisify(execFile);
const cueSchema = z.object({
  reference: z.string(),
  text: z.string(),
  start: z.number().finite().nonnegative(),
  end: z.number().finite().positive(),
});
const timingSchema = z.object({
  duration: z.number().finite().positive(),
  cues: z.array(cueSchema).min(1),
  alignment: z
    .object({ method: z.string(), model: z.string(), version: z.number() })
    .optional(),
});
export type ReadingVerse = { verse: number; reference: string; text: string };
export const readingVerseFile = (
  sources: string,
  part: string,
  verse: number,
) => path.join(sources, part, `verse-${verse}.wav`);

/** Keep legacy recordings usable for selective regeneration without synthesizing other verses. */
export async function migrateReadingVerses(
  sources: string,
  part: string,
  verses: ReadingVerse[],
  ffmpeg: string,
  offsets: Array<{
    reference: string;
    startOffsetSeconds: number;
    endOffsetSeconds: number;
  }> = [],
) {
  const combined = path.join(sources, `4-${part}.wav`);
  let saved: z.infer<typeof timingSchema>;
  try {
    saved = timingSchema.parse(
      JSON.parse(await fs.readFile(combined + ".json", "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await fs.mkdir(path.join(sources, part), { recursive: true });
  for (const verse of verses) {
    const target = readingVerseFile(sources, part, verse.verse);
    if (
      await Promise.all([fs.stat(target), fs.stat(target + ".json")]).then(
        (stats) => stats.every((stat) => stat.size > 0),
        () => false,
      )
    )
      continue;
    const cue = saved.cues.find((c) => c.reference === verse.reference);
    if (!cue) throw new Error("Missing legacy reading verse");
    const offset = offsets.find((cut) => cut.reference === verse.reference);
    const start = Math.max(
        0,
        cue.start + Math.min(-1, offset?.startOffsetSeconds ?? 0),
      ),
      end = Math.min(
        saved.duration,
        cue.end + Math.max(1, offset?.endOffsetSeconds ?? 0),
      );
    const directory = await fs.mkdtemp(path.join(sources, part, ".migrate-"));
    try {
      const file = path.join(directory, "verse.wav");
      await run(ffmpeg, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-i",
        combined,
        "-af",
        `atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS`,
        "-c:a",
        "pcm_s24le",
        "-threads",
        "1",
        "-y",
        file,
      ]);
      await fs.writeFile(
        file + ".json",
        JSON.stringify({
          duration: end - start,
          cues: [{ ...cue, start: cue.start - start, end: cue.end - start }],
          alignment: saved.alignment,
        }),
      );
      await fs.rename(file, target);
      await fs.rename(file + ".json", target + ".json");
      await fs.writeFile(target.replace(/\.wav$/, ".txt"), verse.text + "\n");
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

/** Rendering uses a derived combined track; individual verse recordings remain authoritative. */
export async function assembleReadingVerses(
  sources: string,
  part: string,
  verses: ReadingVerse[],
  ffmpeg: string,
) {
  const tracks = [];
  for (const verse of verses) {
    const file = readingVerseFile(sources, part, verse.verse);
    const saved = timingSchema.parse(
      JSON.parse(await fs.readFile(file + ".json", "utf8")),
    );
    const cue = saved.cues[0];
    if (
      saved.cues.length !== 1 ||
      cue.reference !== verse.reference ||
      cue.end <= cue.start ||
      cue.end > saved.duration
    )
      throw new Error("Invalid generated verse recording");
    tracks.push({ file, saved });
  }
  const directory = await fs.mkdtemp(path.join(sources, part, ".combine-"));
  try {
    const listing = path.join(directory, "files.txt");
    await fs.writeFile(
      listing,
      tracks
        .map((track) => `file '${track.file.replaceAll("'", "'\\''")}'`)
        .join("\n"),
    );
    const output = path.join(directory, "combined.wav");
    await run(ffmpeg, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listing,
      "-c:a",
      "pcm_s24le",
      "-ar",
      "48000",
      "-threads",
      "1",
      "-y",
      output,
    ]);
    let duration = 0;
    const cues = tracks.map(({ saved }) => {
      const cue = saved.cues[0];
      const result = {
        ...cue,
        start: cue.start + duration,
        end: cue.end + duration,
      };
      duration += saved.duration;
      return result;
    });
    await fs.writeFile(
      output + ".json",
      JSON.stringify({
        duration,
        cues,
        alignment: {
          method: "forced",
          model: tracks.at(-1)!.saved.alignment?.model ?? "legacy",
          version: 1,
        },
      }),
    );
    const target = path.join(sources, `4-${part}.wav`);
    await fs.rename(output, target);
    await fs.rename(output + ".json", target + ".json");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
