import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { config, type Version } from "./config.js";
import { generateVoice, voiceContext } from "./voice.js";
import { renderShortVideo, type AudioSection, type IntroTitle, type VoiceTracks } from "./video.js";

export interface Point { chapter: number; verse: number }
export interface Passage { id: string; book: string; start: Point; end: Point }
interface Book { id: string; name: string; chapters: number; versesPerChapter: number[] }
interface BibleIndex { metadata: { name: string }; books: Book[] }
interface Verse { verse: number; text: string }
export interface UsedRecord { usedAt: string; locale: string; version: string; output: string }
export type Status = Record<string, UsedRecord>;
export interface PassageOffsets { startSeconds: number; endSeconds: number }

/** Keep editorial order within each group while moving used passages to the end. */
export function orderPassagesByUsage(catalog: readonly Passage[], status: Status): Passage[] {
  return [...catalog.filter(passage => !status[passage.id]), ...catalog.filter(passage => Boolean(status[passage.id]))];
}

const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../popular-verses.json");
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const execFileAsync = promisify(execFile);

function wordCount(text: string): number {
  return text.replace(/\(H\d+-\d+\)/g, "").split(/\s+/u).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

async function audioDurationSeconds(file: string): Promise<number> {
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

async function readPassageOffsets(outputDir: string, replaceExisting: boolean): Promise<{ values: PassageOffsets; text: string }> {
  const file = path.join(outputDir, "offsets.json");
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
    const passage = entry as Passage;
    if (!safeId.test(passage.id) || !safeId.test(passage.book) || ids.has(passage.id)) throw new Error(`Invalid or duplicate ID/book in entry ${index + 1}`);
    ids.add(passage.id);
    assertPoint(passage.start, `${passage.id}.start`);
    assertPoint(passage.end, `${passage.id}.end`);
    if (passage.start.chapter > passage.end.chapter || (passage.start.chapter === passage.end.chapter && passage.start.verse > passage.end.verse)) {
      throw new Error(`Passage start must come before its end: ${passage.id}`);
    }
    return passage;
  });
}

export function reference(bookName: string, passage: Passage): string {
  const a = passage.start, b = passage.end;
  return `${bookName} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
}

export function introTitle(locale: Version["locale"], passageReference: string, versionName: string): IntroTitle {
  const titles: Record<Version["locale"], string> = {
    es: "Esta es tu dosis diaria de la palabra de Dios",
    en: "This is your daily dose of the word of God",
    pt: "Esta é a sua dose diária da palavra de Deus"
  };
  return { title: titles[locale], reference: passageReference, version: versionName };
}

export async function readIndex(version: Version): Promise<BibleIndex> {
  return JSON.parse(await fs.readFile(path.join(config.bibleDataDir, version.locale, version.id, "index.json"), "utf8")) as BibleIndex;
}

export function getBook(index: BibleIndex, passage: Passage): { book: Book; number: number } {
  const number = index.books.findIndex(book => book.id === passage.book) + 1;
  if (!number) throw new Error(`Book ${passage.book} is unavailable in this version`);
  const book = index.books[number - 1];
  for (const point of [passage.start, passage.end]) {
    if (point.chapter > book.chapters || point.verse > (book.versesPerChapter[point.chapter - 1] ?? 0)) {
      throw new Error(`Verse out of range: ${reference(book.name, passage)}`);
    }
  }
  return { book, number };
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
  for (const part of ["intro", "outro"] as const) {
    const file = path.join(outputDir, `${part}.wav`);
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size === 0) return false;
      await audioDurationSeconds(file);
      const script = await fs.stat(path.join(outputDir, `${part}.txt`));
      if (!script.isFile() || script.size === 0) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof Error && /^(Invalid audio duration:|Could not get the duration of )/.test(error.message)) return false;
      throw error;
    }
  }
  return true;
}

async function copyVoiceTracks(previousOutput: string, staging: string): Promise<void> {
  for (const part of ["intro", "outro"] as const) {
    await fs.copyFile(path.join(previousOutput, `${part}.wav`), path.join(staging, `${part}.wav`));
    await fs.copyFile(path.join(previousOutput, `${part}.txt`), path.join(staging, `${part}.txt`));
  }
}

export async function prepareShort(version: Version, passage: Passage, replaceExisting = false, reuseVoices = false): Promise<string> {
  const index = await readIndex(version);
  const { book, number } = getBook(index, passage);
  const label = reference(book.name, passage);
  const lines: string[] = [];
  const sections: AudioSection[] = [];
  const sourceDurations: number[] = [];
  for (let chapter = passage.start.chapter; chapter <= passage.end.chapter; chapter++) {
    const first = chapter === passage.start.chapter ? passage.start.verse : 1;
    const last = chapter === passage.end.chapter ? passage.end.verse : book.versesPerChapter[chapter - 1];
    const all = await versesForChapter(version, book, chapter);
    const selected = all.filter(v => v.verse >= first && v.verse <= last);
    if (selected.length !== last - first + 1 || selected.some((v, i) => v.verse !== first + i)) throw new Error(`Missing verses from ${book.name} ${chapter}:${first}-${last}`);
    lines.push(...selected.map(v => `${chapter}:${v.verse} ${v.text}`));
    const source = await chapterAudio(version, book, number, chapter);
    const sourceDuration = await audioDurationSeconds(source);
    const estimate = estimateAudioRange(all, first, last, sourceDuration);
    const { start, end } = await refineAudioRange(source, estimate, sourceDuration);
    sections.push({ file: source, start, end });
    sourceDurations.push(sourceDuration);
  }

  const destination = path.join(config.outputDir, version.id, passage.id);
  let destinationExists = false;
  try {
    await fs.lstat(destination);
    destinationExists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (destinationExists && !replaceExisting) throw new Error(`Output already exists: ${destination}`);
  if (!destinationExists && replaceExisting) throw new Error(`Output no longer exists: ${destination}`);
  const offsets = await readPassageOffsets(destination, replaceExisting);
  const baseSections = sections.map(section => ({ ...section }));
  sections[0].start += offsets.values.startSeconds;
  sections[sections.length - 1].end += offsets.values.endSeconds;
  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    if (section.start < 0 || section.end > sourceDurations[index] || section.end <= section.start) {
      throw new Error(`Offsets in ${path.join(destination, "offsets.json")} produce an invalid audio cut for ${path.basename(section.file)}`);
    }
  }
  if (reuseVoices && (!replaceExisting || config.clipAudioMode === "video" || !await canReuseVoiceTracks(destination))) {
    throw new Error(`Reusable intro/outro WAV and text files are unavailable in ${destination}`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = await fs.mkdtemp(path.join(path.dirname(destination), `.short-${passage.id}-`));
  try {
    await fs.writeFile(path.join(temp, "offsets.json"), offsets.text, "utf8");
    await fs.writeFile(path.join(temp, "versiculos.txt"), `${label} — ${index.metadata.name}\n\n${lines.join("\n")}\n`, "utf8");
    if (!["video", "voice", "mix"].includes(config.clipAudioMode)) throw new Error(`Invalid VEOBIBLE_SHORTS_CLIP_AUDIO_MODE: ${config.clipAudioMode}`);
    let voices: VoiceTracks | undefined;
    if (config.clipAudioMode !== "video") {
      if (reuseVoices) {
        console.log("Reusing existing intro and outro audio...");
        await copyVoiceTracks(destination, temp);
      } else {
        await generateVoice(temp, voiceContext(version, passage, book.name, index.metadata.name));
      }
      voices = { intro: path.join(temp, "intro.wav"), outro: path.join(temp, "outro.wav"), mode: config.clipAudioMode as "voice" | "mix" };
    }
    const video = await renderShortVideo(path.join(temp, "short.mp4"), sections, config.videosDir, introTitle(version.locale, label, index.metadata.name), voices);
    await fs.writeFile(path.join(temp, "metadata.txt"), [
      `Referencia: ${label}`,
      `ID del pasaje: ${passage.id}`,
      `Idioma: ${version.locale}`,
      `Versión: ${index.metadata.name} (${version.id})`,
      `Libro: ${book.name} (${book.id})`,
      `Inicio: ${passage.start.chapter}:${passage.start.verse}`,
      `Fin: ${passage.end.chapter}:${passage.end.verse}`,
      `Vídeo final: short.mp4`,
      `Vídeos: 0-intro.mp4, ${video.background} (boomerang en bucle), 0-outro.mp4`,
      `Audio de intro y outro: ${config.clipAudioMode}`,
      `Locuciones reutilizadas: ${reuseVoices ? "sí" : "no"}`,
      `Duración estimada de la lectura: ${video.readingDuration.toFixed(2)} s`,
      `Duración estimada del vídeo: ${video.duration.toFixed(2)} s`,
      `Límites base antes de offsets: ${baseSections.map(section => `${path.basename(section.file)} [${section.start.toFixed(2)}–${section.end.toFixed(2)} s]`).join(", ")}`,
      `Offsets aplicados: inicio ${offsets.values.startSeconds.toFixed(2)} s; fin ${offsets.values.endSeconds.toFixed(2)} s`,
      `Audio bíblico: ${sections.map(section => `${path.basename(section.file)} [${section.start.toFixed(2)}–${section.end.toFixed(2)} s]`).join(", ")}`,
      `Cálculo: proporción de palabras ajustada a pausas cercanas detectadas con ffmpeg; comprueba el corte escuchando el vídeo.`,
      `Ajustes manuales: offsets.json`,
      `Texto: versiculos.txt`,
      ""
    ].join("\n"), "utf8");
    await installPreparedOutput(temp, destination, replaceExisting);
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

const statusPath = () => path.join(config.outputDir, "status.json");

export async function readStatus(): Promise<Status> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(statusPath(), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid status.json");
    return parsed as Status;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function markUsed(passage: Passage, version: Version, output: string): Promise<void> {
  const status = await readStatus();
  if (status[passage.id]) throw new Error(`Passage ${passage.id} is already marked as used`);
  status[passage.id] = { usedAt: new Date().toISOString(), locale: version.locale, version: version.id, output };
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
