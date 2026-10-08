import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config.js";
import type { AudioSection } from "./video.js";

const execFileAsync = promisify(execFile);

export interface VerseCue {
  reference: string;
  text: string;
  start: number;
  end: number;
}
export interface VerseTimingInput {
  chapter: number;
  bookName: string;
  verses: Array<{ verse: number; text: string }>;
  section: AudioSection;
}
interface Pause {
  start: number;
  end: number;
}
export interface VerseOffset {
  reference: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
}

function speakingWeight(text: string): number {
  const clean = text.replace(/\(H\d+-\d+\)/g, "");
  const words = clean
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  const letters = [...clean].filter((char) =>
    /[\p{L}\p{N}]/u.test(char),
  ).length;
  return Math.max(1, words + letters / 20);
}

/** FFmpeg detects acoustic pauses, which can improve but cannot guarantee word alignment. */
export async function detectPauses(source: string): Promise<Pause[]> {
  try {
    const { stderr } = await execFileAsync(
      config.ffmpegBin,
      [
        "-hide_banner",
        "-nostats",
        "-nostdin",
        "-i",
        source,
        "-vn",
        "-af",
        "silencedetect=noise=-35dB:d=0.16",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    const pauses: Pause[] = [];
    let start: number | undefined;
    for (const line of stderr.split(/\r?\n/)) {
      const begin = /silence_start:\s*([\d.]+)/.exec(line);
      if (begin) start = Number(begin[1]);
      const finish = /silence_end:\s*([\d.]+)/.exec(line);
      if (finish && start !== undefined) {
        pauses.push({ start, end: Number(finish[1]) });
        start = undefined;
      }
    }
    return pauses;
  } catch {
    console.log(
      `Could not analyze verse pauses in ${path.basename(source)}; using text-based timing.`,
    );
    return [];
  }
}

export function estimateChapterCues(
  input: VerseTimingInput,
  pauses: Pause[],
): VerseCue[] {
  const { verses, section, chapter, bookName } = input;
  if (!verses.length || section.end <= section.start)
    throw new Error(`Invalid verses for ${bookName} ${chapter}`);
  const weights = verses.map((verse) => speakingWeight(verse.text));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const length = section.end - section.start;
  const boundaries = [section.start];
  let cumulative = 0;
  for (let index = 0; index < verses.length - 1; index++) {
    cumulative += weights[index];
    const expected = section.start + (length * cumulative) / totalWeight;
    const previousDuration = (length * weights[index]) / totalWeight;
    const nextDuration = (length * weights[index + 1]) / totalWeight;
    const window = Math.min(
      2,
      Math.max(0.25, Math.min(previousDuration, nextDuration) * 0.45),
    );
    const minimum = boundaries[index] + 0.08;
    const maximum = section.end - (verses.length - index - 1) * 0.08;
    const candidates = pauses
      .map((pause) => pause.end - 0.03)
      .filter(
        (point) =>
          point >= minimum &&
          point <= maximum &&
          Math.abs(point - expected) <= window,
      );
    const nearest = candidates.sort(
      (a, b) => Math.abs(a - expected) - Math.abs(b - expected),
    )[0];
    boundaries.push(Math.max(minimum, Math.min(maximum, nearest ?? expected)));
  }
  boundaries.push(section.end);
  return verses.map((verse, index) => ({
    reference: `${bookName} ${chapter}:${verse.verse}`,
    text: verse.text
      .replace(/\(H\d+-\d+\)/g, "")
      .replace(/\s+/gu, " ")
      .trim(),
    start: boundaries[index],
    end: boundaries[index + 1],
  }));
}

export async function estimateVerseCues(
  inputs: VerseTimingInput[],
): Promise<VerseCue[]> {
  const cues: VerseCue[] = [];
  let elapsed = 0;
  for (const input of inputs) {
    const pauses = await detectPauses(input.section.file);
    for (const cue of estimateChapterCues(input, pauses)) {
      cues.push({
        ...cue,
        start: elapsed + cue.start - input.section.start,
        end: elapsed + cue.end - input.section.start,
      });
    }
    elapsed += input.section.end - input.section.start;
  }
  return cues;
}

/** Apply request offsets to current estimates without reading or writing project state. */
export function applyVerseOffsets(
  estimates: VerseCue[],
  overrides: VerseOffset[] = [],
  sourceDuration = estimates.at(-1)?.end ?? 0,
): VerseCue[] {
  const file = "request verse offsets";
  const previous = overrides;
  const offsets = new Map<string, VerseOffset>();
  for (const entry of previous) {
    if (
      !entry ||
      typeof entry.reference !== "string" ||
      !Number.isFinite(entry.startOffsetSeconds) ||
      !Number.isFinite(entry.endOffsetSeconds) ||
      offsets.has(entry.reference)
    ) {
      throw new Error(`Invalid verse offset entry in ${file}`);
    }
    offsets.set(entry.reference, entry);
  }
  const references = new Set(estimates.map((estimate) => estimate.reference));
  const unknown = [...offsets.keys()].filter(
    (reference) => !references.has(reference),
  );
  if (unknown.length)
    throw new Error(
      `Unknown verse references in ${file}: ${unknown.join(", ")}`,
    );
  const duration = sourceDuration;
  const cues: VerseCue[] = [];
  estimates.forEach((estimate) => {
    const offset = offsets.get(estimate.reference);
    const startOffsetSeconds = offset?.startOffsetSeconds ?? 0;
    const endOffsetSeconds = offset?.endOffsetSeconds ?? 0;
    const start = estimate.start + startOffsetSeconds;
    const end = estimate.end + endOffsetSeconds;
    if (start < 0 || end > duration + 1e-6 || end <= start) {
      throw new Error(
        `Offsets for ${estimate.reference} in ${file} produce invalid verse timings`,
      );
    }
    cues.push({ ...estimate, start, end });
  });
  return cues;
}
