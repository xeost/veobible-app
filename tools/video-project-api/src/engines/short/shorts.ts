import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config, type Version } from "./config.js";
import type { AudioSection, IntroTitle } from "./video.js";
import type { VerseTimingInput } from "./verse-timing.js";

export interface Point {
  chapter: number;
  verse: number;
}
export interface Passage {
  id: string;
  book: string;
  start: Point;
  end: Point;
}
interface Book {
  id: string;
  name: string;
  chapters: number;
  versesPerChapter: number[];
}
interface BibleIndex {
  metadata: { name: string };
  books: Book[];
}
interface Verse {
  verse: number;
  text: string;
}
export interface PassageTextVerse {
  reference: string;
  text: string;
  inPassage: boolean;
}

export interface PassageOffsets {
  startSeconds: number;
  endSeconds: number;
}

const execFileAsync = promisify(execFile);

function wordCount(text: string): number {
  return text
    .replace(/\(H\d+-\d+\)/g, "")
    .split(/\s+/u)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export async function audioDurationSeconds(file: string): Promise<number> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(config.ffprobeBin, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]));
  } catch (error) {
    throw new Error(
      `Could not get the duration of ${file} with ffprobe: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error(`Invalid audio duration: ${file}`);
  return duration;
}

function estimateAudioRange(
  verses: Verse[],
  first: number,
  last: number,
  duration: number,
): { start: number; end: number } {
  const total = verses.reduce((sum, verse) => sum + wordCount(verse.text), 0);
  if (total === 0)
    throw new Error("No words available to estimate audio timings");
  const before = verses
    .filter((verse) => verse.verse < first)
    .reduce((sum, verse) => sum + wordCount(verse.text), 0);
  const through = verses
    .filter((verse) => verse.verse <= last)
    .reduce((sum, verse) => sum + wordCount(verse.text), 0);
  return {
    start: (duration * before) / total,
    end: (duration * through) / total,
  };
}

/** Snap approximate verse edges to nearby pauses; FFmpeg cannot identify verse words. */
export async function refineAudioRange(
  source: string,
  estimate: { start: number; end: number },
  duration: number,
): Promise<{ start: number; end: number }> {
  if (estimate.start === 0 && estimate.end === duration) return estimate;
  let stderr: string;
  try {
    ({ stderr } = await execFileAsync(
      config.ffmpegBin,
      [
        "-hide_banner",
        "-nostats",
        "-nostdin",
        "-i",
        source,
        "-vn",
        "-af",
        "silencedetect=noise=-35dB:d=0.18",
        "-f",
        "null",
        "-",
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    ));
  } catch {
    console.log(
      `Could not analyze pauses in ${path.basename(source)}; using word-based timing.`,
    );
    return estimate;
  }
  const pauses: Array<{ start: number; end: number }> = [];
  let pauseStart: number | undefined;
  for (const line of stderr.split(/\r?\n/)) {
    const start = /silence_start:\s*([\d.]+)/.exec(line);
    if (start) pauseStart = Number(start[1]);
    const end = /silence_end:\s*([\d.]+)/.exec(line);
    if (end && pauseStart !== undefined) {
      pauses.push({ start: pauseStart, end: Number(end[1]) });
      pauseStart = undefined;
    }
  }
  if (pauseStart !== undefined)
    pauses.push({ start: pauseStart, end: duration });
  const nearest = (
    target: number,
    edge: "start" | "end",
  ): number | undefined => {
    const candidates = pauses.map((pause) =>
      edge === "start"
        ? Math.max(0, pause.end - 0.04)
        : Math.min(duration, pause.start + 0.08),
    );
    const close = candidates.filter(
      (candidate) => Math.abs(candidate - target) <= 3,
    );
    return close.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
  };
  const start =
    estimate.start > 0
      ? (nearest(estimate.start, "start") ?? estimate.start)
      : 0;
  const end =
    estimate.end < duration
      ? (nearest(estimate.end, "end") ?? estimate.end)
      : duration;
  return end > start ? { start, end } : estimate;
}

export function reference(bookName: string, passage: Passage): string {
  const a = passage.start,
    b = passage.end;
  return `${bookName} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
}

export function introTitle(
  locale: Version["locale"],
  passageReference: string,
  versionName: string,
): IntroTitle {
  const titles: Record<Version["locale"], string> = {
    es: "Esta es tu dosis diaria de la palabra de Dios",
    en: "This is your daily dose of the word of God",
    pt: "Esta é a sua dose diária da palavra de Deus",
  };
  return {
    title: titles[locale],
    reference: passageReference,
    version: versionName,
  };
}

export async function readIndex(version: Version): Promise<BibleIndex> {
  return JSON.parse(
    await fs.readFile(
      path.join(config.bibleDataDir, version.locale, version.id, "index.json"),
      "utf8",
    ),
  ) as BibleIndex;
}

export function getBook(
  index: BibleIndex,
  passage: Passage,
): { book: Book; number: number } {
  const number = index.books.findIndex((book) => book.id === passage.book) + 1;
  if (!number)
    throw new Error(`Book ${passage.book} is unavailable in this version`);
  const book = index.books[number - 1];
  for (const point of [passage.start, passage.end]) {
    if (
      point.chapter > book.chapters ||
      point.verse > (book.versesPerChapter[point.chapter - 1] ?? 0)
    ) {
      throw new Error(`Verse out of range: ${reference(book.name, passage)}`);
    }
  }
  return { book, number };
}

async function versesForChapter(
  version: Version,
  book: Book,
  chapter: number,
): Promise<Verse[]> {
  const root = path.join(config.bibleDataDir, version.locale, version.id);
  const file = path.join(root, book.id, `${chapter}.json`);
  const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (item) =>
        item &&
        Number.isSafeInteger(item.verse) &&
        typeof item.text === "string",
    )
  ) {
    throw new Error(`Invalid verse format: ${file}`);
  }
  return parsed as Verse[];
}

async function findChapterAudio(
  dir: string,
  book: Book,
  number: number,
  chapter: number,
): Promise<string> {
  const prefix = `${String(number).padStart(2, "0")}-${book.id}-${chapter}`;
  for (const ext of [".mp3", ".m4a", ".MP3", ".M4A"]) {
    const candidate = path.join(dir, prefix + ext);
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(
    `Missing audio for chapter ${chapter}: ${path.join(dir, prefix)}.{mp3,m4a}`,
  );
}

async function chapterAudio(
  version: Version,
  book: Book,
  number: number,
  chapter: number,
): Promise<string> {
  return findChapterAudio(
    path.join(config.audioDir, version.id),
    book,
    number,
    chapter,
  );
}

export async function analyzePassageAudio(version: Version, passage: Passage) {
  const index = await readIndex(version);
  const { book, number } = getBook(index, passage);
  const label = reference(book.name, passage);
  const lines: string[] = [];
  const sections: AudioSection[] = [];
  const timingInputs: VerseTimingInput[] = [];
  const sourceDurations: number[] = [];
  for (
    let chapter = passage.start.chapter;
    chapter <= passage.end.chapter;
    chapter++
  ) {
    const first = chapter === passage.start.chapter ? passage.start.verse : 1;
    const last =
      chapter === passage.end.chapter
        ? passage.end.verse
        : book.versesPerChapter[chapter - 1];
    const all = await versesForChapter(version, book, chapter);
    const selected = all.filter((v) => v.verse >= first && v.verse <= last);
    if (
      selected.length !== last - first + 1 ||
      selected.some((v, i) => v.verse !== first + i)
    )
      throw new Error(
        `Missing verses from ${book.name} ${chapter}:${first}-${last}`,
      );
    lines.push(...selected.map((v) => `${chapter}:${v.verse} ${v.text}`));
    const source = await chapterAudio(version, book, number, chapter);
    const sourceDuration = await audioDurationSeconds(source);
    const estimate = estimateAudioRange(all, first, last, sourceDuration);
    const { start, end } = await refineAudioRange(
      source,
      estimate,
      sourceDuration,
    );
    const section = { file: source, start, end };
    sections.push(section);
    timingInputs.push({
      chapter,
      bookName: book.name,
      verses: selected,
      section,
    });
    sourceDurations.push(sourceDuration);
  }

  return { index, book, label, lines, sections, timingInputs, sourceDurations };
}

/** Include up to two neighboring verses on each side, crossing chapter boundaries within the book. */
export async function readPassageTextContext(
  version: Version,
  passage: Passage,
  index?: BibleIndex,
): Promise<PassageTextVerse[]> {
  const { book } = getBook(index ?? (await readIndex(version)), passage);
  const before: Point[] = [],
    after: Point[] = [],
    selected: Point[] = [];
  let point = { ...passage.start };
  for (let count = 0; count < 2; count++) {
    if (point.verse > 1) point = { ...point, verse: point.verse - 1 };
    else if (point.chapter > 1)
      point = {
        chapter: point.chapter - 1,
        verse: book.versesPerChapter[point.chapter - 2],
      };
    else break;
    before.unshift(point);
  }
  point = { ...passage.end };
  for (let count = 0; count < 2; count++) {
    if (point.verse < book.versesPerChapter[point.chapter - 1])
      point = { ...point, verse: point.verse + 1 };
    else if (point.chapter < book.chapters)
      point = { chapter: point.chapter + 1, verse: 1 };
    else break;
    after.push(point);
  }
  for (
    let chapter = passage.start.chapter;
    chapter <= passage.end.chapter;
    chapter++
  ) {
    const first = chapter === passage.start.chapter ? passage.start.verse : 1;
    const last =
      chapter === passage.end.chapter
        ? passage.end.verse
        : book.versesPerChapter[chapter - 1];
    for (let verse = first; verse <= last; verse++)
      selected.push({ chapter, verse });
  }
  const chapters = new Map<number, Verse[]>();
  const result: PassageTextVerse[] = [];
  for (const [points, inPassage] of [
    [before, false],
    [selected, true],
    [after, false],
  ] as const) {
    for (const point of points) {
      if (!chapters.has(point.chapter)) {
        try {
          chapters.set(
            point.chapter,
            await versesForChapter(version, book, point.chapter),
          );
        } catch (error) {
          if (
            !inPassage &&
            (error as NodeJS.ErrnoException).code === "ENOENT"
          ) {
            chapters.set(point.chapter, []);
          } else throw error;
        }
      }
      const verse = chapters
        .get(point.chapter)!
        .find((verse) => verse.verse === point.verse);
      if (verse)
        result.push({
          reference: `${book.name} ${point.chapter}:${point.verse}`,
          text: verse.text,
          inPassage,
        });
      else if (inPassage)
        throw new Error(
          `Missing verse ${book.name} ${point.chapter}:${point.verse}`,
        );
    }
  }
  return result;
}

export function applyPassageAudioOffsets(
  sections: AudioSection[],
  sourceDurations: number[],
  offsets: PassageOffsets,
): AudioSection[] {
  if (!sections.length || sourceDurations.length !== sections.length)
    throw new Error("Missing audio sections or source durations");
  if (
    !Number.isFinite(offsets.startSeconds) ||
    !Number.isFinite(offsets.endSeconds)
  )
    throw new Error("Audio offsets must be finite numbers");
  const adjusted = sections.map((section) => ({ ...section }));
  adjusted[0].start += offsets.startSeconds;
  adjusted[adjusted.length - 1].end += offsets.endSeconds;
  for (let index = 0; index < adjusted.length; index++) {
    const section = adjusted[index];
    if (
      section.start < 0 ||
      section.end > sourceDurations[index] ||
      section.end <= section.start
    ) {
      throw new Error(
        `Audio offsets produce an invalid audio cut for ${path.basename(section.file)}`,
      );
    }
  }
  return adjusted;
}
