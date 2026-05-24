/**
 * Filesystem helpers — manages sources/, outputs/, and logs/ directories.
 *
 * Expected working directory structure:
 *   <workingDir>/
 *     sources/
 *       audios/
 *         <versionId>/          ← chapter MP3 files: <NN>-<bookId>-<chapter>.mp3
 *       images/                 ← book thumbnails:   <NN>-<bookId>-<versionId>.<ext>
 *     outputs/                  ← generated video + thumbnail + upload txt
 *     logs/                     ← daily log files
 */
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { log } from "./logger.js";
import { padBookNumber } from "./bible.js";
import type { BibleVersion, BookMetadata } from "./types.js";

// ─── Directory paths ─────────────────────────────────────────────────────────

export const sourcesJsonDir = (versionId: string) =>
  path.join(config.workingDir, "sources", versionId);

export const sourcesAudiosDir = (versionId: string) =>
  path.join(config.workingDir, "sources", "audios", versionId);

export const sourcesImagesDir = () =>
  path.join(config.workingDir, "sources", "images");

export const outputsDir = () =>
  path.join(config.workingDir, "outputs");

export const logsDir = () =>
  path.join(config.workingDir, "logs");

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export function ensureWorkingDirs(versionId: string): void {
  for (const dir of [
    sourcesJsonDir(versionId),
    sourcesAudiosDir(versionId),
    sourcesImagesDir(),
    outputsDir(),
    logsDir(),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Output file name helpers ─────────────────────────────────────────────────

/**
 * Returns the base name (without extension) for all output files of a book.
 * Pattern: <NN>-<bookId>-<versionId>
 * Example: "01-genesis-rv1909"
 */
export function getOutputBaseName(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  return `${padBookNumber(bookNumber)}-${bookId}-${versionId}`;
}

export function getOutputVideoPath(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  return path.join(outputsDir(), `${getOutputBaseName(bookNumber, bookId, versionId)}.mp4`);
}

export function getOutputInfoPath(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  return path.join(outputsDir(), `${getOutputBaseName(bookNumber, bookId, versionId)}-upload.txt`);
}

export function getOutputThumbnailPath(
  bookNumber: number,
  bookId: string,
  versionId: string,
  ext: string
): string {
  return path.join(outputsDir(), `${getOutputBaseName(bookNumber, bookId, versionId)}-thumb${ext}`);
}

// ─── Source audio files ───────────────────────────────────────────────────────

/**
 * Returns a sorted list of chapter audio file paths for a given book.
 * Files must follow the naming pattern: <NN>-<bookId>-<chapter>.mp3
 * They are sorted numerically by chapter number.
 *
 * Example: ["01-genesis-1.mp3", "01-genesis-2.mp3", ..., "01-genesis-50.mp3"]
 */
export function getChapterAudioFiles(
  bookNumber: number,
  bookId: string,
  versionId: string,
  totalChapters: number
): { chapterNumber: number; filePath: string; exists: boolean }[] {
  const dir = sourcesAudiosDir(versionId);
  const prefix = `${padBookNumber(bookNumber)}-${bookId}-`;

  return Array.from({ length: totalChapters }, (_, i) => {
    const chapterNumber = i + 1;
    const filePath = path.join(dir, `${prefix}${chapterNumber}.mp3`);
    return { chapterNumber, filePath, exists: fs.existsSync(filePath) };
  });
}

/**
 * Returns the paths of all existing chapter audio files, sorted by chapter number.
 * Only files that actually exist on disk are returned.
 */
export function getExistingChapterAudioFiles(
  bookNumber: number,
  bookId: string,
  versionId: string,
  totalChapters: number
): string[] {
  return getChapterAudioFiles(bookNumber, bookId, versionId, totalChapters)
    .filter((f) => f.exists)
    .map((f) => f.filePath);
}

// ─── Source image file ────────────────────────────────────────────────────────

/**
 * Finds the book thumbnail image in sources/images/.
 * Pattern: <NN>-<bookId>-<versionId>.<ext>
 * Returns the full path if found, or null.
 */
export function findImageFile(
  bookNumber: number,
  bookId: string,
  versionId: string
): string | null {
  const dir = sourcesImagesDir();
  const base = `${padBookNumber(bookNumber)}-${bookId}-${versionId}`;

  for (const ext of ["jpeg", "jpg", "png", "webp"]) {
    const candidate = path.join(dir, `${base}.${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ─── Readiness check ─────────────────────────────────────────────────────────

export interface BookReadinessResult {
  bookNumber: number;
  bookId: string;
  bookName: string;
  label: string;
  hasAudios: boolean;
  missingChapters: number[];
  hasImage: boolean;
  ready: boolean;
}

export function checkReadiness(
  targets: { bookNumber: number; bookId: string; bookName: string }[],
  versionId: string,
  chaptersPerBook: Record<string, number>
): BookReadinessResult[] {
  return targets.map((t) => {
    const totalChapters = chaptersPerBook[t.bookId] ?? 0;
    const chapterFiles = getChapterAudioFiles(t.bookNumber, t.bookId, versionId, totalChapters);
    const missingChapters = chapterFiles
      .filter((f) => !f.exists)
      .map((f) => f.chapterNumber);

    const hasAudios = missingChapters.length === 0 && totalChapters > 0;
    const hasImage = findImageFile(t.bookNumber, t.bookId, versionId) !== null;
    const ready = hasAudios && hasImage;
    const label = `${String(t.bookNumber).padStart(2, "0")}. ${t.bookName}`;

    return {
      bookNumber: t.bookNumber,
      bookId: t.bookId,
      bookName: t.bookName,
      label,
      hasAudios,
      missingChapters,
      hasImage,
      ready,
    };
  });
}

// ─── Source JSON metadata files ──────────────────────────────────────────

/**
 * Returns the path for a book's JSON metadata file in sources/<versionId>/.
 * Pattern: <NN>-<bookId>-<versionId>.json
 * Example: sources/rv1909/01-genesis-rv1909.json
 */
export function getJsonSourcePath(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  const base = `${padBookNumber(bookNumber)}-${bookId}-${versionId}.json`;
  return path.join(sourcesJsonDir(versionId), base);
}

/**
 * Returns the JSON source path if the file exists, or null.
 */
export function findJsonFile(
  bookNumber: number,
  bookId: string,
  versionId: string
): string | null {
  const candidate = getJsonSourcePath(bookNumber, bookId, versionId);
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Reads and parses a book's JSON metadata file.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function readBookMetadata(
  bookNumber: number,
  bookId: string,
  versionId: string
): BookMetadata | null {
  const jsonPath = findJsonFile(bookNumber, bookId, versionId);
  if (!jsonPath) return null;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as BookMetadata;
  } catch {
    return null;
  }
}

/**
 * Filters a list of targets to only those that have an existing JSON metadata file.
 * This allows users to run Step 1 and then manually delete JSON files to
 * exclude specific books from subsequent steps.
 */
export function filterTargetsByJson(
  targets: { bookNumber: number; bookId: string; bookName: string }[],
  versionId: string
): { bookNumber: number; bookId: string; bookName: string }[] {
  return targets.filter((t) => findJsonFile(t.bookNumber, t.bookId, versionId) !== null);
}

// ─── Last book tracking ───────────────────────────────────────────────────────

/**
 * Saves the last processed book number to a per-version log file.
 * File: <logsDir>/last-book-<versionId>.log
 */
export function saveLastBook(bookNumber: number, versionId: string): void {
  const dir = logsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, `last-book-${versionId}.log`);
  fs.writeFileSync(logFile, bookNumber.toString(), "utf-8");
  log("INFO", `Saved last book (${bookNumber}) for ${versionId} to ${logFile}`);
}

/**
 * Returns the last processed book number for the given version, or null.
 */
export function getLastBook(versionId: string): number | null {
  const logFile = path.join(logsDir(), `last-book-${versionId}.log`);
  if (!fs.existsSync(logFile)) return null;
  try {
    const content = fs.readFileSync(logFile, "utf-8").trim();
    const num = parseInt(content, 10);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}
