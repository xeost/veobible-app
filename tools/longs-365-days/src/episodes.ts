import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { config, type Version } from "./config.js";
import { generateVoice, voiceContext, type VoicePart } from "./voice.js";
import { renderEpisodeVideo, generateThumbnail, type AudioSection, type IntroTitle, type VoiceTracks } from "./video.js";
import { outroTitle } from "./social.js";
import { applyVerseOffsets, estimateVerseCues, type VerseTimingInput, type VerseOffset } from "./verse-timing.js";
import { existingInternalFile, internalFilename } from "./output-files.js";
import { publicationDescriptions } from "./publication.js";
import { readReadingAudioSettings, ensureDefaultVersionSettings } from "./reading-audio.js";

export interface Point { chapter: number; verse: number }
export interface Passage { id: string; book: string; endBook?: string; endBookName?: string; episode?: number; start: Point; end: Point }
interface Book { id: string; name: string; chapters: number; versesPerChapter: number[] }
interface BibleIndex { metadata: { name: string }; books: Book[] }
interface Verse { verse: number; text: string }
export interface PassageTextVerse { reference: string; text: string; inPassage: boolean }
export interface UsedRecord { usedAt: string; locale: string; version: string; output: string }
export type Status = Record<string, UsedRecord>;
export interface PassageOffsets { startSeconds: number; endSeconds: number }
export interface TimingAdjustments { passageOffsets: PassageOffsets; verseOffsets: VerseOffset[] }

export function passageUsageKey(version: { locale: string; id: string }, passage: Pick<Passage, "id">): string {
  return `${version.locale}/${version.id}/${passage.id}`;
}

export function isPassageUsed(status: Status, version: { locale: string; id: string }, passage: Pick<Passage, "id">): boolean {
  return Boolean(status[passageUsageKey(version, passage)]);
}

/** Keep editorial order within each group while moving used passages to the end. */
export function orderPassagesByUsage(catalog: readonly Passage[], status: Status, version: { locale: string; id: string }): Passage[] {
  return [...catalog.filter(passage => !isPassageUsed(status, version, passage)), ...catalog.filter(passage => isPassageUsed(status, version, passage))];
}

const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../episodes.json");
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const execFileAsync = promisify(execFile);

function wordCount(text: string): number {
  return text.replace(/\(H\d+-\d+\)/g, "").split(/\s+/u).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

export async function audioDurationSeconds(file: string): Promise<number> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(config.ffprobeBin, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
  } catch (error) {
    throw new Error(`Could not get the duration of ${file} with ffprobe: ${error instanceof Error ? error.message : String(error)}`);
  }
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid audio duration: ${file}`);
  return duration;
}

function estimateAudioRange(verses: Verse[], first: number, last: number, duration: number): { start: number; end: number } {
  const total = verses.reduce((sum, verse) => sum + wordCount(verse.text), 0);
  if (total === 0) throw new Error("No words available to estimate audio timings");
  const before = verses.filter(verse => verse.verse < first).reduce((sum, verse) => sum + wordCount(verse.text), 0);
  const through = verses.filter(verse => verse.verse <= last).reduce((sum, verse) => sum + wordCount(verse.text), 0);
  return { start: duration * before / total, end: duration * through / total };
}

/** Snap approximate verse edges to nearby pauses; FFmpeg cannot identify verse words. */
export async function refineAudioRange(source: string, estimate: { start: number; end: number }, duration: number): Promise<{ start: number; end: number }> {
  if (estimate.start === 0 && estimate.end === duration) return estimate;
  let stderr: string;
  try {
    ({ stderr } = await execFileAsync(config.ffmpegBin, ["-hide_banner", "-nostats", "-nostdin", "-i", source, "-vn", "-af", "silencedetect=noise=-35dB:d=0.18", "-f", "null", "-"], { maxBuffer: 4 * 1024 * 1024 }));
  } catch {
    console.log(`Could not analyze pauses in ${path.basename(source)}; using word-based timing.`);
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
  if (pauseStart !== undefined) pauses.push({ start: pauseStart, end: duration });
  const nearest = (target: number, edge: "start" | "end"): number | undefined => {
    const candidates = pauses.map(pause => edge === "start" ? Math.max(0, pause.end - 0.04) : Math.min(duration, pause.start + 0.08));
    const close = candidates.filter(candidate => Math.abs(candidate - target) <= 3);
    return close.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
  };
  const start = estimate.start > 0 ? nearest(estimate.start, "start") ?? estimate.start : 0;
  const end = estimate.end < duration ? nearest(estimate.end, "end") ?? estimate.end : duration;
  return end > start ? { start, end } : estimate;
}

export async function readPassageOffsets(outputDir: string, replaceExisting: boolean): Promise<{ values: PassageOffsets; text: string }> {
  const file = await existingInternalFile(outputDir, "offsets.json");
  let text = '{\n  "startSeconds": 0,\n  "endSeconds": 0\n}\n';
  if (replaceExisting) {
    try {
      text = await fs.readFile(file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${file}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Invalid offsets in ${file}`);
  const values = parsed as PassageOffsets;
  if (!Number.isFinite(values.startSeconds) || !Number.isFinite(values.endSeconds)) throw new Error(`Offsets must contain numeric startSeconds and endSeconds: ${file}`);
  return { values, text };
}

function assertPoint(value: unknown, label: string): asserts value is Point {
  if (!value || typeof value !== "object") throw new Error(`${label}: chapter and verse are required`);
  const point = value as Point;
  if (!Number.isSafeInteger(point.chapter) || point.chapter < 1 || !Number.isSafeInteger(point.verse) || point.verse < 1) {
    throw new Error(`${label}: chapter and verse must be positive integers`);
  }
}

export async function loadCatalog(): Promise<Passage[]> {
  const raw: unknown = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("The catalog must be a non-empty list");
  const ids = new Set<string>();
  return raw.map((entry: unknown, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Invalid entry ${index + 1}`);
    const episode = entry as { id: number; start: Point & { book: string }; end: Point & { book: string } };
    assertPoint(episode.start, `Episode ${index + 1}.start`);
    assertPoint(episode.end, `Episode ${index + 1}.end`);
    if (!Number.isSafeInteger(episode.id) || episode.id < 1 || episode.id > 365 || !safeId.test(episode.start.book) || !safeId.test(episode.end.book)) {
      throw new Error(`Invalid episode ID/book in entry ${index + 1}`);
    }
    const passage: Passage = { id: `episode-${String(episode.id).padStart(3, "0")}`, episode: episode.id, book: episode.start.book, endBook: episode.end.book,
      start: { chapter: episode.start.chapter, verse: episode.start.verse }, end: { chapter: episode.end.chapter, verse: episode.end.verse } };
    if (ids.has(passage.id)) throw new Error(`Duplicate episode ID: ${episode.id}`);
    ids.add(passage.id);
    assertPoint(passage.start, `${passage.id}.start`);
    assertPoint(passage.end, `${passage.id}.end`);
    if (passage.book === passage.endBook && (passage.start.chapter > passage.end.chapter || (passage.start.chapter === passage.end.chapter && passage.start.verse > passage.end.verse))) {
      throw new Error(`Passage start must come before its end: ${passage.id}`);
    }
    return passage;
  });
}

export function reference(bookName: string, passage: Passage): string {
  const a = passage.start, b = passage.end;
  if (passage.endBook && passage.endBook !== passage.book) {
    return `${bookName} ${a.chapter}:${a.verse} – ${passage.endBookName ?? passage.endBook} ${b.chapter}:${b.verse}`;
  }
  return `${bookName} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
}

export function introTitle(locale: Version["locale"], passageReference: string, versionName: string, episode?: number): IntroTitle {
  const titles: Record<Version["locale"], string> = {
    es: "La Biblia en 365 días",
    en: "The Bible in 365 days",
    pt: "A Bíblia em 365 dias"
  };
  const day = { es: "Día", en: "Day", pt: "Dia" }[locale];
  return { title: titles[locale], reference: passageReference, version: `${versionName}${episode ? ` · ${day} ${episode}` : ""}` };
}

export async function readIndex(version: Version): Promise<BibleIndex> {
  return JSON.parse(await fs.readFile(path.join(config.bibleDataDir, version.locale, version.id, "index.json"), "utf8")) as BibleIndex;
}

export function getBook(index: BibleIndex, passage: Passage): { book: Book; number: number } {
  const number = index.books.findIndex(book => book.id === passage.book) + 1;
  if (!number) throw new Error(`Book ${passage.book} is unavailable in this version`);
  const book = index.books[number - 1];
  const endIndex = index.books.findIndex(item => item.id === (passage.endBook ?? passage.book));
  if (endIndex < number - 1) throw new Error(`Episode end book is unavailable or precedes its start: ${passage.id}`);
  const endBook = index.books[endIndex];
  passage.endBookName = endBook.name;
  for (const [point, endpointBook] of [[passage.start, book], [passage.end, endBook]] as const) {
    if (point.chapter > endpointBook.chapters || point.verse > (endpointBook.versesPerChapter[point.chapter - 1] ?? 0)) {
      throw new Error(`Verse out of range: ${reference(book.name, passage)}`);
    }
  }
  return { book, number };
}

/** Chapter ranges in canonical index order, including episodes crossing books. */
export function passageChapters(index: BibleIndex, passage: Passage): Array<{ book: Book; number: number; chapter: number; first: number; last: number }> {
  const { number } = getBook(index, passage);
  const finalIndex = index.books.findIndex(book => book.id === (passage.endBook ?? passage.book));
  const ranges: Array<{ book: Book; number: number; chapter: number; first: number; last: number }> = [];
  for (let i = number - 1; i <= finalIndex; i++) {
    const book = index.books[i];
    const firstChapter = i === number - 1 ? passage.start.chapter : 1;
    const lastChapter = i === finalIndex ? passage.end.chapter : book.chapters;
    for (let chapter = firstChapter; chapter <= lastChapter; chapter++) {
      ranges.push({ book, number: i + 1, chapter,
        first: i === number - 1 && chapter === firstChapter ? passage.start.verse : 1,
        last: i === finalIndex && chapter === lastChapter ? passage.end.verse : book.versesPerChapter[chapter - 1] });
    }
  }
  return ranges;
}

async function versesForChapter(version: Version, book: Book, chapter: number): Promise<Verse[]> {
  const root = path.join(config.bibleDataDir, version.locale, version.id);
  const file = path.join(root, book.id, `${chapter}.json`);
  const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every(item => item && Number.isSafeInteger(item.verse) && typeof item.text === "string")) {
    throw new Error(`Invalid verse format: ${file}`);
  }
  return parsed as Verse[];
}

async function findChapterAudio(dir: string, book: Book, number: number, chapter: number): Promise<string> {
  const prefix = `${String(number).padStart(2, "0")}-${book.id}-${chapter}`;
  for (const ext of [".mp3", ".m4a", ".MP3", ".M4A"]) {
    const candidate = path.join(dir, prefix + ext);
    try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(`Missing audio for chapter ${chapter}: ${path.join(dir, prefix)}.{mp3,m4a}`);
}

async function chapterAudio(version: Version, book: Book, number: number, chapter: number): Promise<string> {
  return findChapterAudio(path.join(config.audioDir, version.id), book, number, chapter);
}

/** Swap a fully prepared directory into place, restoring the old one if installation fails. */
export async function installPreparedOutput(staging: string, destination: string, replaceExisting: boolean): Promise<void> {
  if (!replaceExisting) {
    await fs.rename(staging, destination);
    return;
  }
  const backup = `${destination}.backup-${randomUUID()}`;
  await fs.rename(destination, backup);
  try {
    await fs.rename(staging, destination);
  } catch (error) {
    try {
      await fs.rename(backup, destination);
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], `Could not replace ${destination}; previous output remains at ${backup}`);
    }
    throw error;
  }
  await fs.rm(backup, { recursive: true, force: true });
}

/** Existing WAV tracks and scripts can be reused without loading the voice model or calling the API. */
export async function canReuseVoiceTracks(outputDir: string): Promise<boolean> {
  return (await reusableVoiceParts(outputDir)).length === 2;
}

export async function reusableVoiceParts(outputDir: string): Promise<VoicePart[]> {
  const parts: VoicePart[] = [];
  for (const part of ["intro", "outro"] as const) {
    const file = await existingInternalFile(outputDir, `${part}.wav`);
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size === 0) continue;
      await audioDurationSeconds(file);
      const script = await fs.stat(await existingInternalFile(outputDir, `${part}.txt`));
      if (!script.isFile() || script.size === 0) continue;
      parts.push(part);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof Error && /^(Invalid audio duration:|Could not get the duration of )/.test(error.message)) continue;
      throw error;
    }
  }
  return parts;
}

async function copyVoiceTracks(previousOutput: string, staging: string, parts: VoicePart[]): Promise<void> {
  for (const part of parts) {
    await fs.copyFile(await existingInternalFile(previousOutput, `${part}.wav`), path.join(staging, internalFilename(`${part}.wav`)));
    await fs.copyFile(await existingInternalFile(previousOutput, `${part}.txt`), path.join(staging, internalFilename(`${part}.txt`)));
  }
}

/** Generate only the requested track, leaving the other voice and rendered video intact. */
export async function regenerateVoiceTrack(version: Version, passage: Passage, part: VoicePart): Promise<string> {
  const destination = path.join(config.outputDir, version.id, passage.id);
  const index = await readIndex(version);
  const { book } = getBook(index, passage);
  const internal = path.join(destination, "_internal");
  await fs.mkdir(internal, { recursive: true });
  try {
    await fs.writeFile(path.join(internal, "README.md"), await fs.readFile(fileURLToPath(new URL("../internal-readme.md", import.meta.url))), { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const staging = await fs.mkdtemp(path.join(internal, ".regenerate-voice-"));
  const installed: Array<{ target: string; backup?: string }> = [];
  try {
    await generateVoice(staging, voiceContext(version, passage, book.name, index.metadata.name), false, part);
    await audioDurationSeconds(path.join(staging, `${part}.wav`));
    for (const extension of ["wav", "txt"]) {
      const name = `${part}.${extension}`;
      const target = path.join(internal, internalFilename(name));
      const backup = path.join(staging, `previous-${name}`);
      let exists = true;
      try { await fs.copyFile(target, backup); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; exists = false; }
      await fs.rename(path.join(staging, name), target);
      installed.push({ target, backup: exists ? backup : undefined });
    }
    return path.join(internal, internalFilename(`${part}.wav`));
  } catch (error) {
    for (const item of installed.reverse()) {
      if (item.backup) await fs.rename(item.backup, item.target);
      else await fs.rm(item.target, { force: true });
    }
    throw error;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

/** Shared analysis for rendering and the interactive timing editor. */
export async function analyzePassageAudio(version: Version, passage: Passage) {
  const index = await readIndex(version);
  const { book } = getBook(index, passage);
  const label = reference(book.name, passage);
  const lines: string[] = [];
  const sections: AudioSection[] = [];
  const timingInputs: VerseTimingInput[] = [];
  const sourceDurations: number[] = [];
  for (const { book, number, chapter, first, last } of passageChapters(index, passage)) {
    const all = await versesForChapter(version, book, chapter);
    const selected = all.filter(v => v.verse >= first && v.verse <= last);
    if (selected.length !== last - first + 1 || selected.some((v, i) => v.verse !== first + i)) throw new Error(`Missing verses from ${book.name} ${chapter}:${first}-${last}`);
    lines.push(...selected.map(v => `${book.name} ${chapter}:${v.verse} ${v.text}`));
    const source = await chapterAudio(version, book, number, chapter);
    const sourceDuration = await audioDurationSeconds(source);
    const estimate = estimateAudioRange(all, first, last, sourceDuration);
    const { start, end } = await refineAudioRange(source, estimate, sourceDuration);
    const section = { file: source, start, end };
    sections.push(section);
    timingInputs.push({ chapter, bookName: book.name, verses: selected, section });
    sourceDurations.push(sourceDuration);
  }

  return { index, book, label, lines, sections, timingInputs, sourceDurations };
}

/** Context crosses chapter and book boundaries in canonical order. */
export async function readPassageTextContext(version: Version, passage: Passage, index?: BibleIndex): Promise<PassageTextVerse[]> {
  const bible = index ?? await readIndex(version);
  const ranges = passageChapters(bible, passage);
  type Location = Point & { bookIndex: number };
  const first = ranges[0], last = ranges.at(-1)!;
  const selected: Location[] = ranges.flatMap(range => Array.from({ length: range.last - range.first + 1 }, (_, i) => ({ bookIndex: range.number - 1, chapter: range.chapter, verse: range.first + i })));
  const before: Location[] = [], after: Location[] = [];
  const neighbor = (point: Location, direction: -1 | 1): Location | undefined => {
    const book = bible.books[point.bookIndex];
    if (direction === -1) {
      if (point.verse > 1) return { ...point, verse: point.verse - 1 };
      if (point.chapter > 1) return { ...point, chapter: point.chapter - 1, verse: book.versesPerChapter[point.chapter - 2] };
      const previous = bible.books[point.bookIndex - 1];
      return previous ? { bookIndex: point.bookIndex - 1, chapter: previous.chapters, verse: previous.versesPerChapter[previous.chapters - 1] } : undefined;
    }
    if (point.verse < book.versesPerChapter[point.chapter - 1]) return { ...point, verse: point.verse + 1 };
    if (point.chapter < book.chapters) return { ...point, chapter: point.chapter + 1, verse: 1 };
    return bible.books[point.bookIndex + 1] ? { bookIndex: point.bookIndex + 1, chapter: 1, verse: 1 } : undefined;
  };
  for (const [seed, direction, target] of [
    [{ bookIndex: first.number - 1, chapter: first.chapter, verse: first.first }, -1, before],
    [{ bookIndex: last.number - 1, chapter: last.chapter, verse: last.last }, 1, after]
  ] as const) {
    let point: Location | undefined = seed;
    for (let count = 0; count < 2; count++) {
      point = neighbor(point, direction);
      if (!point) break;
      if (direction === -1) target.unshift(point); else target.push(point);
    }
  }
  const chapters = new Map<string, Verse[]>();
  const result: PassageTextVerse[] = [];
  for (const [points, inPassage] of [[before, false], [selected, true], [after, false]] as const) {
    for (const point of points) {
      const book = bible.books[point.bookIndex], key = book.id + "/" + point.chapter;
      if (!chapters.has(key)) {
        try { chapters.set(key, await versesForChapter(version, book, point.chapter)); }
        catch (error) {
          if (!inPassage && (error as NodeJS.ErrnoException).code === "ENOENT") chapters.set(key, []);
          else throw error;
        }
      }
      const verse = chapters.get(key)!.find(verse => verse.verse === point.verse);
      if (verse) result.push({ reference: book.name + " " + point.chapter + ":" + point.verse, text: verse.text, inPassage });
      else if (inPassage) throw new Error("Missing verse " + book.name + " " + point.chapter + ":" + point.verse);
    }
  }
  return result;
}

export function applyPassageAudioOffsets(sections: AudioSection[], sourceDurations: number[], offsets: PassageOffsets): AudioSection[] {
  if (!sections.length || sourceDurations.length !== sections.length) throw new Error("Missing audio sections or source durations");
  if (!Number.isFinite(offsets.startSeconds) || !Number.isFinite(offsets.endSeconds)) throw new Error("Audio offsets must be finite numbers");
  const adjusted = sections.map(section => ({ ...section }));
  adjusted[0].start += offsets.startSeconds;
  adjusted[adjusted.length - 1].end += offsets.endSeconds;
  for (let index = 0; index < adjusted.length; index++) {
    const section = adjusted[index];
    if (section.start < 0 || section.end > sourceDurations[index] || section.end <= section.start) {
      throw new Error(`Audio offsets produce an invalid audio cut for ${path.basename(section.file)}`);
    }
  }
  return adjusted;
}

export async function prepareEpisode(version: Version, passage: Passage, replaceExisting = false, reuseVoices = false, adjustments?: TimingAdjustments, volumeMultiplier?: number): Promise<string> {
  const { index, book, label, lines, sections: baseSections, timingInputs, sourceDurations } = await analyzePassageAudio(version, passage);

  const destination = path.join(config.outputDir, version.id, passage.id);
  let destinationExists = false;
  try {
    await fs.lstat(destination);
    destinationExists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!replaceExisting && await hasRenderedEpisode(destination)) throw new Error(`Output already exists: ${destination}`);
  if (!destinationExists && replaceExisting) throw new Error(`Output no longer exists: ${destination}`);
  const offsets = adjustments
    ? { values: adjustments.passageOffsets, text: JSON.stringify(adjustments.passageOffsets, null, 2) + "\n" }
    : await readPassageOffsets(destination, destinationExists);
  const readingSettings = await readReadingAudioSettings(destination, destinationExists, volumeMultiplier);
  const sections = applyPassageAudioOffsets(baseSections, sourceDurations, offsets.values);
  const adjustedInputs = timingInputs.map((input, index) => ({ ...input, section: sections[index] }));
  const verseTimings = await applyVerseOffsets(destination, destinationExists, await estimateVerseCues(adjustedInputs), adjustments?.verseOffsets);
  const reusable = reuseVoices ? await reusableVoiceParts(destination) : [];
  if (reuseVoices && (config.clipAudioMode === "video" || !reusable.length)) {
    throw new Error(`Reusable intro/outro WAV and text files are unavailable in ${destination}`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = await fs.mkdtemp(path.join(path.dirname(destination), `.episode-${passage.id}-`));
  try {
    const internal = path.join(temp, "_internal");
    await fs.mkdir(internal);
    await fs.copyFile(fileURLToPath(new URL("../internal-readme.md", import.meta.url)), path.join(internal, "README.md"));
    await fs.writeFile(path.join(internal, internalFilename("offsets.json")), offsets.text, "utf8");
    await fs.writeFile(path.join(internal, internalFilename("reading-audio.json")), readingSettings.text, "utf8");
    await fs.writeFile(path.join(internal, internalFilename("verse-offsets.json")), verseTimings.text, "utf8");
    await fs.writeFile(path.join(internal, internalFilename("versiculos.txt")), `${label} — ${index.metadata.name}\n\n${lines.join("\n")}\n`, "utf8");
    if (!["video", "voice", "mix"].includes(config.clipAudioMode)) throw new Error(`Invalid VEOBIBLE_LONGS_CLIP_AUDIO_MODE: ${config.clipAudioMode}`);
    let voices: VoiceTracks | undefined;
    if (config.clipAudioMode !== "video") {
      if (reuseVoices) {
        console.log("Reusing existing generated voice audio...");
        await copyVoiceTracks(destination, internal, reusable);
        for (const part of ["intro", "outro"] as const) {
          if (reusable.includes(part)) continue;
          await generateVoice(internal, voiceContext(version, passage, book.name, index.metadata.name), false, part);
          for (const extension of ["wav", "txt"]) {
            const name = `${part}.${extension}`;
            await fs.rename(path.join(internal, name), path.join(internal, internalFilename(name)));
          }
        }
      } else {
        await generateVoice(internal, voiceContext(version, passage, book.name, index.metadata.name));
        for (const name of ["intro.wav", "intro.txt", "outro.wav", "outro.txt"]) {
          await fs.rename(path.join(internal, name), path.join(internal, internalFilename(name)));
        }
      }
      voices = { intro: path.join(internal, internalFilename("intro.wav")), outro: path.join(internal, internalFilename("outro.wav")), mode: config.clipAudioMode as "voice" | "mix" };
    }
    const title = introTitle(version.locale, label, index.metadata.name, passage.episode);
    const video = await renderEpisodeVideo(path.join(temp, "episode.mp4"), sections, config.videosDir, title, await outroTitle(version.locale), verseTimings.cues, voices, internal, readingSettings.volumeMultiplier);
    await generateThumbnail(path.join(temp, "episode.mp4"), path.join(temp, "thumbnail.jpg"), video.thumbnailTime);
    for (const [name, text] of Object.entries(publicationDescriptions(version.locale, title, lines))) {
      await fs.writeFile(path.join(temp, name), text, "utf8");
    }
    await fs.writeFile(path.join(internal, internalFilename("metadata.txt")), [
      `Referencia: ${label}`,
      `ID del pasaje: ${passage.id}`,
      `Idioma: ${version.locale}`,
      `Versión: ${index.metadata.name} (${version.id})`,
      `Libro: ${book.name} (${book.id})`,
      `Inicio: ${passage.start.chapter}:${passage.start.verse}`,
      `Fin: ${passage.end.chapter}:${passage.end.verse}`,
      `Vídeo final: ../episode.mp4`,
      `Miniatura: ../thumbnail.jpg (fotograma en ${video.thumbnailTime.toFixed(6)} s)`,
      `Vídeos: 0-intro.mp4, ${video.background} (boomerang en bucle), 0-outro.mp4`,
      `Audio de intro y outro: ${config.clipAudioMode}`,
      `Volumen de la lectura: ${readingSettings.volumeMultiplier}x`,
      `Configuración del audio de lectura: ${internalFilename("reading-audio.json")}`,
      `Locuciones reutilizadas: ${reuseVoices ? "sí" : "no"}`,
      `Duración estimada de la lectura: ${video.readingDuration.toFixed(2)} s`,
      `Duración estimada del vídeo: ${video.duration.toFixed(2)} s`,
      `Límites base antes de offsets: ${baseSections.map(section => `${path.basename(section.file)} [${section.start.toFixed(2)}–${section.end.toFixed(2)} s]`).join(", ")}`,
      `Offsets aplicados: inicio ${offsets.values.startSeconds.toFixed(2)} s; fin ${offsets.values.endSeconds.toFixed(2)} s`,
      `Audio bíblico: ${sections.map(section => `${path.basename(section.file)} [${section.start.toFixed(2)}–${section.end.toFixed(2)} s]`).join(", ")}`,
      `Cálculo: proporción de palabras ajustada a pausas cercanas detectadas con ffmpeg; comprueba el corte escuchando el vídeo.`,
      `Ajustes manuales: ${internalFilename("offsets.json")}`,
      `Tiempos y ajustes de versículos: ${internalFilename("verse-offsets.json")}`,
      `Texto: ${internalFilename("versiculos.txt")}`,
      ""
    ].join("\n"), "utf8");
    await installPreparedOutput(temp, destination, destinationExists);
    await ensureDefaultVersionSettings(destination, readingSettings.volumeMultiplier);
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

const statusPath = () => path.join(config.outputDir, "status.json");

export async function hasRenderedEpisode(outputDir: string): Promise<boolean> {
  try { const stat = await fs.stat(path.join(outputDir, "episode.mp4")); return stat.isFile() && stat.size > 0; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

export async function readStatus(): Promise<Status> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(statusPath(), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid status.json");
    const status: Status = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid status.json record: ${key}`);
      const record = value as UsedRecord;
      if (![record.locale, record.version, record.usedAt, record.output].every(field => typeof field === "string" && field.length > 0)) {
        throw new Error(`Invalid status.json record: ${key}`);
      }
      const parts = key.split("/");
      const passageId = parts.length === 1 ? key : parts.length === 3 && parts[0] === record.locale && parts[1] === record.version ? parts[2] : undefined;
      if (!passageId) throw new Error(`Invalid status.json key: ${key}`);
      // Legacy records belong only to the locale/version recorded in their metadata.
      const scopedKey = passageUsageKey({ locale: record.locale, id: record.version }, { id: passageId });
      if (key === scopedKey || !status[scopedKey]) status[scopedKey] = record;
    }
    return status;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function markUsed(passage: Passage, version: Version, output: string): Promise<void> {
  const status = await readStatus();
  const key = passageUsageKey(version, passage);
  if (status[key]) throw new Error(`Passage ${key} is already marked as used`);
  status[key] = { usedAt: new Date().toISOString(), locale: version.locale, version: version.id, output };
  await writeStatus(status);
}

export async function unmarkUsed(passage: Passage, version: Version): Promise<void> {
  const status = await readStatus();
  delete status[passageUsageKey(version, passage)];
  await writeStatus(status);
}

async function writeStatus(status: Status): Promise<void> {
  await fs.mkdir(config.outputDir, { recursive: true });
  const temp = path.join(config.outputDir, `.status-${process.pid}-${Date.now()}.json`);
  try {
    await fs.writeFile(temp, JSON.stringify(status, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    await fs.rename(temp, statusPath());
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
}
