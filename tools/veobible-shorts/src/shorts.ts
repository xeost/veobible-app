import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config, type Version } from "./config.js";

export interface Point { chapter: number; verse: number }
export interface Passage { id: string; book: string; start: Point; end: Point }
interface Book { id: string; name: string; chapters: number; versesPerChapter: number[] }
interface BibleIndex { metadata: { name: string }; books: Book[] }
interface Verse { verse: number; text: string }
export interface UsedRecord { usedAt: string; locale: string; version: string; output: string }
export type Status = Record<string, UsedRecord>;

const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../popular-verses.json");
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const execFileAsync = promisify(execFile);
const timingHeader = "Tiempos estimados por archivo (segundos desde el inicio del original, WAV y AIFF):";
const timingExplanation = "Cálculo: duración medida con ffprobe y límites estimados por la proporción de palabras. Cada WAV y AIFF incluye hasta 5 segundos antes y después del rango, sin superar los límites del capítulo. Verificar escuchando antes de cortar.";
const wavHeader = "Archivos WAV recortados para DaVinci Resolve:";
const aiffHeader = "Archivos AIFF recortados para DaVinci Resolve:";
const legacyWavHeader = "Archivos WAV para DaVinci Resolve:";
const marginSeconds = 5;

function wordCount(text: string): number {
  return text.replace(/\(H\d+-\d+\)/g, "").split(/\s+/u).filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

async function audioDurationSeconds(file: string): Promise<number> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
  } catch (error) {
    throw new Error(`No se pudo obtener la duración de ${file} con ffprobe: ${error instanceof Error ? error.message : String(error)}`);
  }
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Duración de audio inválida: ${file}`);
  return duration;
}

async function convertToWav(source: string, target: string, clipStart: number, clipEnd: number): Promise<void> {
  const clipDuration = clipEnd - clipStart;
  const fadeDuration = Math.min(0.02, clipDuration / 4);
  const fadeOutStart = clipDuration - fadeDuration;
  try {
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-i", source,
      "-map", "0:a:0", "-vn", "-af", [
        `atrim=start=${clipStart.toFixed(6)}:end=${clipEnd.toFixed(6)}`,
        "asetpts=PTS-STARTPTS",
        `afade=t=in:st=0:d=${fadeDuration.toFixed(6)}`,
        `afade=t=out:st=${fadeOutStart.toFixed(6)}:d=${fadeDuration.toFixed(6)}`
      ].join(","),
      "-c:a", "pcm_s24le", "-ar", "48000", target
    ], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    throw new Error(`No se pudo convertir ${source} a WAV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function wavFilename(source: string): string {
  return `${path.basename(source, path.extname(source))}.wav`;
}

function aiffFilename(source: string): string {
  return `${path.basename(source, path.extname(source))}.aiff`;
}

async function convertWavToAiff(source: string, target: string): Promise<void> {
  try {
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-nostdin", "-n", "-i", source,
      "-map", "0:a:0", "-vn", "-c:a", "pcm_s24be", "-ar", "48000", target
    ], { maxBuffer: 1024 * 1024 });
  } catch (error) {
    throw new Error(`No se pudo convertir ${source} a AIFF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function estimateAudioRange(verses: Verse[], first: number, last: number, duration: number): { start: number; end: number } {
  const total = verses.reduce((sum, verse) => sum + wordCount(verse.text), 0);
  if (total === 0) throw new Error("No hay palabras para estimar los tiempos del audio");
  const before = verses.filter(verse => verse.verse < first).reduce((sum, verse) => sum + wordCount(verse.text), 0);
  const through = verses.filter(verse => verse.verse <= last).reduce((sum, verse) => sum + wordCount(verse.text), 0);
  return { start: duration * before / total, end: duration * through / total };
}

function clipBounds(start: number, end: number, duration: number): { clipStart: number; clipEnd: number } {
  return {
    clipStart: Math.max(0, start - marginSeconds),
    clipEnd: Math.min(duration, end + marginSeconds)
  };
}

function assertPoint(value: unknown, label: string): asserts value is Point {
  if (!value || typeof value !== "object") throw new Error(`${label}: capítulo y versículo requeridos`);
  const point = value as Point;
  if (!Number.isSafeInteger(point.chapter) || point.chapter < 1 || !Number.isSafeInteger(point.verse) || point.verse < 1) {
    throw new Error(`${label}: capítulo y versículo deben ser enteros positivos`);
  }
}

export async function loadCatalog(): Promise<Passage[]> {
  const raw: unknown = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("El catálogo debe ser una lista no vacía");
  const ids = new Set<string>();
  return raw.map((entry: unknown, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Entrada ${index + 1} inválida`);
    const passage = entry as Passage;
    if (!safeId.test(passage.id) || !safeId.test(passage.book) || ids.has(passage.id)) throw new Error(`ID o libro inválido/repetido en entrada ${index + 1}`);
    ids.add(passage.id);
    assertPoint(passage.start, `${passage.id}.start`);
    assertPoint(passage.end, `${passage.id}.end`);
    if (passage.start.chapter > passage.end.chapter || (passage.start.chapter === passage.end.chapter && passage.start.verse > passage.end.verse)) {
      throw new Error(`Rango invertido: ${passage.id}`);
    }
    return passage;
  });
}

export function reference(bookName: string, passage: Passage): string {
  const a = passage.start, b = passage.end;
  return `${bookName} ${a.chapter}:${a.verse}${a.chapter === b.chapter && a.verse === b.verse ? "" : a.chapter === b.chapter ? `-${b.verse}` : `-${b.chapter}:${b.verse}`}`;
}

export async function readIndex(version: Version): Promise<BibleIndex> {
  return JSON.parse(await fs.readFile(path.join(config.bibleDataDir, version.locale, version.id, "index.json"), "utf8")) as BibleIndex;
}

export function getBook(index: BibleIndex, passage: Passage): { book: Book; number: number } {
  const number = index.books.findIndex(book => book.id === passage.book) + 1;
  if (!number) throw new Error(`Libro ${passage.book} no disponible en esta versión`);
  const book = index.books[number - 1];
  for (const point of [passage.start, passage.end]) {
    if (point.chapter > book.chapters || point.verse > (book.versesPerChapter[point.chapter - 1] ?? 0)) {
      throw new Error(`Versículo fuera de rango: ${reference(book.name, passage)}`);
    }
  }
  return { book, number };
}

async function versesForChapter(version: Version, book: Book, chapter: number): Promise<Verse[]> {
  const root = path.join(config.bibleDataDir, version.locale, version.id);
  const file = path.join(root, book.id, `${chapter}.json`);
  const parsed: unknown = JSON.parse(await fs.readFile(file, "utf8"));
  if (!Array.isArray(parsed) || !parsed.every(item => item && Number.isSafeInteger(item.verse) && typeof item.text === "string")) {
    throw new Error(`Formato de versículos inválido: ${file}`);
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
  throw new Error(`Falta el audio del capítulo ${chapter}: ${path.join(dir, prefix)}.{mp3,m4a}`);
}

async function chapterAudio(version: Version, book: Book, number: number, chapter: number): Promise<string> {
  return findChapterAudio(path.join(config.audioDir, version.id), book, number, chapter);
}

function formatAudioTiming(filename: string, chapter: number, first: number, last: number, sourceStart: number, sourceEnd: number, sourceDuration: number, pcmDuration?: number, clipStart = 0, clipEnd = sourceDuration, format = "WAV"): string {
  const sourceTimes = `origen: ${sourceStart.toFixed(1)}–${sourceEnd.toFixed(1)} s`;
  if (pcmDuration === undefined) {
    return `  ${filename} | ${chapter}:${first}-${last} | ${sourceTimes} | duración original ${sourceDuration.toFixed(1)} s`;
  }
  const pcmStart = Math.max(0, sourceStart - clipStart);
  const pcmEnd = Math.min(pcmDuration, sourceEnd - clipStart);
  return `  ${filename} | ${chapter}:${first}-${last} | ${sourceTimes} | recorte del original: ${clipStart.toFixed(1)}–${clipEnd.toFixed(1)} s | en ${format}: ${pcmStart.toFixed(1)}–${pcmEnd.toFixed(1)} s | duración ${format} ${pcmDuration.toFixed(1)} s`;
}

export async function prepareShort(version: Version, passage: Passage): Promise<string> {
  const index = await readIndex(version);
  const { book, number } = getBook(index, passage);
  const label = reference(book.name, passage);
  const lines: string[] = [];
  const audios: { chapter: number; source: string; first: number; last: number; verses: Verse[] }[] = [];
  for (let chapter = passage.start.chapter; chapter <= passage.end.chapter; chapter++) {
    const first = chapter === passage.start.chapter ? passage.start.verse : 1;
    const last = chapter === passage.end.chapter ? passage.end.verse : book.versesPerChapter[chapter - 1];
    const all = await versesForChapter(version, book, chapter);
    const selected = all.filter(v => v.verse >= first && v.verse <= last);
    if (selected.length !== last - first + 1 || selected.some((v, i) => v.verse !== first + i)) throw new Error(`Faltan versículos de ${book.name} ${chapter}:${first}-${last}`);
    lines.push(...selected.map(v => `${chapter}:${v.verse} ${v.text}`));
    const source = await chapterAudio(version, book, number, chapter);
    audios.push({ chapter, source, first, last, verses: all });
  }

  const destination = path.join(config.outputDir, version.id, passage.id);
  try { await fs.access(destination); throw new Error(`La salida ya existe: ${destination}`); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temp = await fs.mkdtemp(path.join(path.dirname(destination), `.short-${passage.id}-`));
  try {
    const filenames: string[] = [];
    const wavFilenames: string[] = [];
    const aiffFilenames: string[] = [];
    const audioLines: string[] = [];
    for (const { chapter, source, first, last, verses } of audios) {
      const filename = `${String(number).padStart(2, "0")}-${book.id}-${chapter}${path.extname(source)}`;
      const copiedAudio = path.join(temp, filename);
      const wav = wavFilename(filename);
      const wavPath = path.join(temp, wav);
      const aiff = aiffFilename(filename);
      const aiffPath = path.join(temp, aiff);
      await fs.copyFile(source, copiedAudio);
      const sourceDuration = await audioDurationSeconds(copiedAudio);
      const { start, end } = estimateAudioRange(verses, first, last, sourceDuration);
      const { clipStart, clipEnd } = clipBounds(start, end, sourceDuration);
      await convertToWav(copiedAudio, wavPath, clipStart, clipEnd);
      await convertWavToAiff(wavPath, aiffPath);
      const wavDuration = await audioDurationSeconds(wavPath);
      const aiffDuration = await audioDurationSeconds(aiffPath);
      filenames.push(filename);
      wavFilenames.push(wav);
      aiffFilenames.push(aiff);
      audioLines.push(formatAudioTiming(wav, chapter, first, last, start, end, sourceDuration, wavDuration, clipStart, clipEnd));
      audioLines.push(formatAudioTiming(aiff, chapter, first, last, start, end, sourceDuration, aiffDuration, clipStart, clipEnd, "AIFF"));
    }
    await fs.writeFile(path.join(temp, "versiculos.txt"), `${label} — ${index.metadata.name}\n\n${lines.join("\n")}\n`, "utf8");
    await fs.writeFile(path.join(temp, "metadata.txt"), [
      `Referencia: ${label}`,
      `ID del rango: ${passage.id}`,
      `Idioma: ${version.locale}`,
      `Versión: ${index.metadata.name} (${version.id})`,
      `Libro: ${book.name} (${book.id})`,
      `Inicio: ${passage.start.chapter}:${passage.start.verse}`,
      `Fin: ${passage.end.chapter}:${passage.end.verse}`,
      `Audio: originales completos por capítulo; WAV y AIFF recortados con hasta 5 s de margen a cada lado`,
      `Archivos de audio originales: ${filenames.join(", ")}`,
      `${wavHeader} ${wavFilenames.join(", ")}`,
      `${aiffHeader} ${aiffFilenames.join(", ")}`,
      timingHeader,
      ...audioLines,
      timingExplanation,
      `Texto: versiculos.txt`,
      ""
    ].join("\n"), "utf8");
    await fs.rename(temp, destination);
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw error;
  }
  return destination;
}

/** Recalculates timing lines for an existing export without touching its audio or verse text. */
export async function refreshMetadataTimings(version: Version, passage: Passage): Promise<string> {
  const index = await readIndex(version);
  const { book, number } = getBook(index, passage);
  const destination = path.join(config.outputDir, version.id, passage.id);
  const metadataPath = path.join(destination, "metadata.txt");
  const original = await fs.readFile(metadataPath, "utf8");
  const audioLines: string[] = [];
  const wavFilenames: string[] = [];
  const aiffFilenames: string[] = [];
  let hasFullLengthPcm = false;
  for (let chapter = passage.start.chapter; chapter <= passage.end.chapter; chapter++) {
    const first = chapter === passage.start.chapter ? passage.start.verse : 1;
    const last = chapter === passage.end.chapter ? passage.end.verse : book.versesPerChapter[chapter - 1];
    const all = await versesForChapter(version, book, chapter);
    const source = await findChapterAudio(destination, book, number, chapter);
    const sourceDuration = await audioDurationSeconds(source);
    const { start, end } = estimateAudioRange(all, first, last, sourceDuration);
    const bounds = clipBounds(start, end, sourceDuration);
    let hasConvertedAudio = false;
    for (const [format, filename, filenames] of [
      ["WAV", wavFilename(source), wavFilenames],
      ["AIFF", aiffFilename(source), aiffFilenames]
    ] as const) {
      const pcmPath = path.join(destination, filename);
      if (!(await fs.access(pcmPath).then(() => true, () => false))) continue;
      hasConvertedAudio = true;
      const pcmDuration = await audioDurationSeconds(pcmPath);
      const expectedClippedDuration = bounds.clipEnd - bounds.clipStart;
      const isClipped = Math.abs(pcmDuration - expectedClippedDuration) < 1;
      const isFull = Math.abs(pcmDuration - sourceDuration) < 1;
      if (!isClipped && !isFull) throw new Error(`Duración ${format} inesperada en ${pcmPath}; vuelve a generar los audios`);
      if (isFull && !isClipped) hasFullLengthPcm = true;
      const clipStart = isClipped ? bounds.clipStart : 0;
      const clipEnd = isClipped ? bounds.clipEnd : sourceDuration;
      filenames.push(filename);
      audioLines.push(formatAudioTiming(filename, chapter, first, last, start, end, sourceDuration, pcmDuration, clipStart, clipEnd, format));
    }
    if (!hasConvertedAudio) {
      audioLines.push(formatAudioTiming(path.basename(source), chapter, first, last, start, end, sourceDuration));
    }
  }

  const lines = original.trimEnd().split("\n");
  const previousStart = lines.findIndex(line => line.startsWith("Tiempos estimados por archivo"));
  if (previousStart !== -1) {
    const previousEnd = lines.findIndex((line, index) => index > previousStart && line.startsWith("Cálculo:"));
    if (previousEnd === -1) throw new Error(`Sección de tiempos incompleta: ${metadataPath}`);
    lines.splice(previousStart, previousEnd - previousStart + 1);
  }
  const previousWav = lines.findIndex(line => line.startsWith(wavHeader) || line.startsWith(legacyWavHeader));
  if (previousWav !== -1) lines.splice(previousWav, 1);
  const previousAiff = lines.findIndex(line => line.startsWith(aiffHeader));
  if (previousAiff !== -1) lines.splice(previousAiff, 1);
  const originals = lines.findIndex(line => line.startsWith("Archivos de audio:") || line.startsWith("Archivos de audio originales:"));
  const formatLines = [
    ...(wavFilenames.length ? [`${hasFullLengthPcm ? legacyWavHeader : wavHeader} ${wavFilenames.join(", ")}`] : []),
    ...(aiffFilenames.length ? [`${aiffHeader} ${aiffFilenames.join(", ")}`] : [])
  ];
  lines.splice(originals === -1 ? lines.length : originals + 1, 0, ...formatLines);
  const audioDescription = lines.findIndex(line => line.startsWith("Audio:"));
  if (audioDescription !== -1 && formatLines.length) {
    const formats = [wavFilenames.length ? "WAV" : "", aiffFilenames.length ? "AIFF" : ""].filter(Boolean).join(" y ");
    lines[audioDescription] = hasFullLengthPcm
      ? `Audio: originales completos por capítulo; hay ${formats} completos anteriores que puedes recortar con Generar WAV y AIFF de 48 kHz`
      : `Audio: originales completos por capítulo; ${formats} recortados con hasta 5 s de margen a cada lado`;
  }
  const insertAt = lines.findIndex(line => line.startsWith("Texto:"));
  const explanation = hasFullLengthPcm
    ? "Cálculo: límites estimados por la proporción de palabras. Algunos audios aún están completos; usa Generar WAV y AIFF de 48 kHz para aplicar el margen de 5 segundos."
    : timingExplanation;
  lines.splice(insertAt === -1 ? lines.length : insertAt, 0, timingHeader, ...audioLines, explanation);
  const temp = path.join(destination, `.metadata-${process.pid}-${Date.now()}.txt`);
  try {
    await fs.writeFile(temp, `${lines.join("\n")}\n`, { encoding: "utf8", flag: "wx" });
    await fs.rename(temp, metadataPath);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }
  return metadataPath;
}

/** Adds WAV and AIFF copies to an existing export, then updates its metadata. */
export async function generateAudioFormatsForExisting(version: Version, passage: Passage): Promise<string> {
  const index = await readIndex(version);
  const { book, number } = getBook(index, passage);
  const destination = path.join(config.outputDir, version.id, passage.id);
  await fs.access(path.join(destination, "metadata.txt"));
  const staging = await fs.mkdtemp(path.join(destination, ".audio-"));
  const converted: string[] = [];
  try {
    for (let chapter = passage.start.chapter; chapter <= passage.end.chapter; chapter++) {
      const original = await findChapterAudio(destination, book, number, chapter);
      const wav = wavFilename(original);
      const aiff = aiffFilename(original);
      const first = chapter === passage.start.chapter ? passage.start.verse : 1;
      const last = chapter === passage.end.chapter ? passage.end.verse : book.versesPerChapter[chapter - 1];
      const verses = await versesForChapter(version, book, chapter);
      const duration = await audioDurationSeconds(original);
      const { start, end } = estimateAudioRange(verses, first, last, duration);
      const { clipStart, clipEnd } = clipBounds(start, end, duration);
      const wavPath = path.join(staging, wav);
      await convertToWav(original, wavPath, clipStart, clipEnd);
      await convertWavToAiff(wavPath, path.join(staging, aiff));
      converted.push(wav, aiff);
    }
    for (const filename of converted) {
      await fs.rename(path.join(staging, filename), path.join(destination, filename));
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
  await refreshMetadataTimings(version, passage);
  return destination;
}

const statusPath = () => path.join(config.outputDir, "status.json");

export async function readStatus(): Promise<Status> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(statusPath(), "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("status.json inválido");
    return parsed as Status;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function markUsed(passage: Passage, version: Version, output: string): Promise<void> {
  const status = await readStatus();
  if (status[passage.id]) throw new Error(`El rango ${passage.id} ya está marcado como utilizado`);
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
