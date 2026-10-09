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
  endBook?: string;
  endBookName?: string;
  episode?: number;
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
  if (passage.endBook && passage.endBook !== passage.book) {
    return `${bookName} ${a.chapter}:${a.verse} – ${passage.endBookName ?? passage.endBook} ${b.chapter}:${b.verse}`;
  }
  return `${bookName} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
}

export function introTitle(
  locale: Version["locale"],
  passageReference: string,
  versionName: string,
  episode?: number,
): IntroTitle {
  const titles: Record<Version["locale"], string> = {
    es: "La Biblia en 365 días",
    en: "The Bible in 365 days",
    pt: "A Bíblia em 365 dias",
  };
  const day = { es: "Día", en: "Day", pt: "Dia" }[locale];
  return {
    title: titles[locale],
    reference: passageReference,
    version: versionName,
    episode,
    dayLabel: day,
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
  const endIndex = index.books.findIndex(
    (item) => item.id === (passage.endBook ?? passage.book),
  );
  if (endIndex < number - 1)
    throw new Error(
      `Episode end book is unavailable or precedes its start: ${passage.id}`,
    );
  const endBook = index.books[endIndex];
  passage.endBookName = endBook.name;
  for (const [point, endpointBook] of [
    [passage.start, book],
    [passage.end, endBook],
  ] as const) {
    if (
      point.chapter > endpointBook.chapters ||
      point.verse > (endpointBook.versesPerChapter[point.chapter - 1] ?? 0)
    ) {
      throw new Error(`Verse out of range: ${reference(book.name, passage)}`);
    }
  }
  return { book, number };
}

/** Chapter ranges in canonical index order, including episodes crossing books. */
export function passageChapters(
  index: BibleIndex,
  passage: Passage,
): Array<{
  book: Book;
  number: number;
  chapter: number;
  first: number;
  last: number;
}> {
  const { number } = getBook(index, passage);
  const finalIndex = index.books.findIndex(
    (book) => book.id === (passage.endBook ?? passage.book),
  );
  const ranges: Array<{
    book: Book;
    number: number;
    chapter: number;
    first: number;
    last: number;
  }> = [];
  for (let i = number - 1; i <= finalIndex; i++) {
    const book = index.books[i];
    const firstChapter = i === number - 1 ? passage.start.chapter : 1;
    const lastChapter = i === finalIndex ? passage.end.chapter : book.chapters;
    for (let chapter = firstChapter; chapter <= lastChapter; chapter++) {
      ranges.push({
        book,
        number: i + 1,
        chapter,
        first:
          i === number - 1 && chapter === firstChapter
            ? passage.start.verse
            : 1,
        last:
          i === finalIndex && chapter === lastChapter
            ? passage.end.verse
            : book.versesPerChapter[chapter - 1],
      });
    }
  }
  return ranges;
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
  const { book } = getBook(index, passage);
  const label = reference(book.name, passage);
  const lines: string[] = [];
  const sections: AudioSection[] = [];
  const timingInputs: VerseTimingInput[] = [];
  const sourceDurations: number[] = [];
  for (const { book, number, chapter, first, last } of passageChapters(
    index,
    passage,
  )) {
    const all = await versesForChapter(version, book, chapter);
    const selected = all.filter((v) => v.verse >= first && v.verse <= last);
    if (
      selected.length !== last - first + 1 ||
      selected.some((v, i) => v.verse !== first + i)
    )
      throw new Error(
        `Missing verses from ${book.name} ${chapter}:${first}-${last}`,
      );
    lines.push(
      ...selected.map((v) => `${book.name} ${chapter}:${v.verse} ${v.text}`),
    );
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

/** Context crosses chapter and book boundaries in canonical order. */
export async function readPassageTextContext(
  version: Version,
  passage: Passage,
  index?: BibleIndex,
): Promise<PassageTextVerse[]> {
  const bible = index ?? (await readIndex(version));
  const ranges = passageChapters(bible, passage);
  type Location = Point & { bookIndex: number };
  const first = ranges[0],
    last = ranges.at(-1)!;
  const selected: Location[] = ranges.flatMap((range) =>
    Array.from({ length: range.last - range.first + 1 }, (_, i) => ({
      bookIndex: range.number - 1,
      chapter: range.chapter,
      verse: range.first + i,
    })),
  );
  const before: Location[] = [],
    after: Location[] = [];
  const neighbor = (
    point: Location,
    direction: -1 | 1,
  ): Location | undefined => {
    const book = bible.books[point.bookIndex];
    if (direction === -1) {
      if (point.verse > 1) return { ...point, verse: point.verse - 1 };
      if (point.chapter > 1)
        return {
          ...point,
          chapter: point.chapter - 1,
          verse: book.versesPerChapter[point.chapter - 2],
        };
      const previous = bible.books[point.bookIndex - 1];
      return previous
        ? {
            bookIndex: point.bookIndex - 1,
            chapter: previous.chapters,
            verse: previous.versesPerChapter[previous.chapters - 1],
          }
        : undefined;
    }
    if (point.verse < book.versesPerChapter[point.chapter - 1])
      return { ...point, verse: point.verse + 1 };
    if (point.chapter < book.chapters)
      return { ...point, chapter: point.chapter + 1, verse: 1 };
    return bible.books[point.bookIndex + 1]
      ? { bookIndex: point.bookIndex + 1, chapter: 1, verse: 1 }
      : undefined;
  };
  for (const [seed, direction, target] of [
    [
      {
        bookIndex: first.number - 1,
        chapter: first.chapter,
        verse: first.first,
      },
      -1,
      before,
    ],
    [
      { bookIndex: last.number - 1, chapter: last.chapter, verse: last.last },
      1,
      after,
    ],
  ] as const) {
    let point: Location | undefined = seed;
    for (let count = 0; count < 2; count++) {
      point = neighbor(point, direction);
      if (!point) break;
      if (direction === -1) target.unshift(point);
      else target.push(point);
    }
  }
  const chapters = new Map<string, Verse[]>();
  const result: PassageTextVerse[] = [];
  for (const [points, inPassage] of [
    [before, false],
    [selected, true],
    [after, false],
  ] as const) {
    for (const point of points) {
      const book = bible.books[point.bookIndex],
        key = book.id + "/" + point.chapter;
      if (!chapters.has(key)) {
        try {
          chapters.set(
            key,
            await versesForChapter(version, book, point.chapter),
          );
        } catch (error) {
          if (!inPassage && (error as NodeJS.ErrnoException).code === "ENOENT")
            chapters.set(key, []);
          else throw error;
        }
      }
      const verse = chapters
        .get(key)!
        .find((verse) => verse.verse === point.verse);
      if (verse)
        result.push({
          reference: book.name + " " + point.chapter + ":" + point.verse,
          text: verse.text,
          inPassage,
        });
      else if (inPassage)
        throw new Error(
          "Missing verse " +
            book.name +
            " " +
            point.chapter +
            ":" +
            point.verse,
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
