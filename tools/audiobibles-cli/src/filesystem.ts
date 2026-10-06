/**
 * Filesystem helpers — manages sources/, outputs/, and logs/ directories.
 *
 * Expected working directory structure:
 *   <workingDir>/
 *     sources/
 *       audios/
 *         <versionId>/          ← chapter audio files: <NN>-<bookId>-<chapter>.<ext> (.mp3, .m4a)
 *       images/                 ← book thumbnails:   <versionId>-<NN>-<bookId>.<ext>
 *     outputs/                  ← generated video + thumbnail + upload txt
 *     logs/                     ← daily log files
 */
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { log } from "./logger.js";
import { padBookNumber } from "./bible.js";
import type { BibleVersion, BookMetadata, BibleBook, BookTarget } from "./types.js";

// ─── Directory paths ─────────────────────────────────────────────────────────

export const sourcesJsonDir = (versionId: string) =>
  path.join(config.workingDir, "sources", "metadata", versionId);

export const sourcesAudiosDir = (versionId: string) =>
  path.join(config.workingDir, "sources", "audios", versionId);

export const sourcesImagesDir = (versionId: string) =>
  path.join(config.workingDir, "sources", "images", versionId);

export const outputsDir = () =>
  path.join(config.workingDir, "outputs");

export const logsDir = () =>
  path.join(config.workingDir, "logs");

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export function ensureWorkingDirs(versionId: string): void {
  for (const dir of [
    sourcesAudiosDir(versionId),
    sourcesImagesDir(versionId),
    outputsDir(),
    logsDir(),
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ─── Output file name helpers ─────────────────────────────────────────────────

/**
 * Returns the base name (without extension) for a book's output files.
 * Pattern: <versionId>-<NN>-<bookId>
 * Example: "rv1909-01-genesis"
 */
export function getOutputBaseName(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  return `${versionId}-${padBookNumber(bookNumber)}-${bookId}`;
}

export function getOutputVideoPath(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  return path.join(outputsDir(), `${getOutputBaseName(bookNumber, bookId, versionId)}-1.mp4`);
}

export function getOutputInfoPath(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  return path.join(outputsDir(), `${getOutputBaseName(bookNumber, bookId, versionId)}-3-upload.txt`);
}

export function getOutputThumbnailPath(
  bookNumber: number,
  bookId: string,
  versionId: string,
  ext: string
): string {
  return path.join(outputsDir(), `${getOutputBaseName(bookNumber, bookId, versionId)}-2-thumb${ext}`);
}

// ─── Multi-book output file name helpers ─────────────────────────────────────

/**
 * Returns the base name (without extension) for a multi-book output.
 * Scope values: "old-testament", "new-testament", "full-bible"
 * Example: "rv1909-old-testament"
 */
export function getMultiBookOutputBaseName(
  scope: string,
  versionId: string
): string {
  return `${versionId}-${scope}`;
}

export function getMultiBookVideoPath(scope: string, versionId: string): string {
  return path.join(outputsDir(), `${getMultiBookOutputBaseName(scope, versionId)}-1.mp4`);
}

export function getMultiBookInfoPath(scope: string, versionId: string): string {
  return path.join(outputsDir(), `${getMultiBookOutputBaseName(scope, versionId)}-3-upload.txt`);
}

// ─── Source audio files ───────────────────────────────────────────────────────

/**
 * Supported audio file extensions (in preferred check order).
 */
export const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".MP3", ".M4A"];

/**
 * Returns a sorted list of chapter audio file paths for a given book.
 * Files must follow the naming pattern: <NN>-<bookId>-<chapter>.<ext> (.mp3 or .m4a)
 * They are sorted numerically by chapter number.
 *
 * Example: ["01-genesis-1.mp3", "01-genesis-2.m4a", ..., "01-genesis-50.mp3"]
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
    let foundPath: string | null = null;

    for (const ext of SUPPORTED_AUDIO_EXTENSIONS) {
      const candidate = path.join(dir, `${prefix}${chapterNumber}${ext}`);
      if (fs.existsSync(candidate)) {
        foundPath = candidate;
        break;
      }
    }

    const filePath = foundPath ?? path.join(dir, `${prefix}${chapterNumber}.mp3`);
    return { chapterNumber, filePath, exists: foundPath !== null };
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
 * Finds the book thumbnail image in sources/images/<versionId>/.
 * Pattern: <NN>-<bookId>.<ext>
 * Returns the full path if found, or null.
 */
export function findImageFile(
  bookNumber: number,
  bookId: string,
  versionId: string
): string | null {
  const dir = sourcesImagesDir(versionId);
  const base = `${padBookNumber(bookNumber)}-${bookId}`;

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

// ─── Contiguous book resolution ──────────────────────────────────────────────

/**
 * Resolves a contiguous list of book targets starting from `startBookNumber`.
 *
 * Rules:
 *   1. Always includes the starting book (1-indexed).
 *   2. Iterates sequentially through subsequent books (startBookNumber + 1, + 2, ...).
 *   3. A subsequent book is included ONLY if ALL its required source files are present:
 *      - All chapter audio files (matching total chapters in index)
 *      - The book thumbnail image
 *   4. As soon as a book is encountered with missing source files, the iteration STOPS immediately.
 *      It never skips a missing book to include a later book (strict contiguity).
 */
export function resolveContiguousTargets(
  versionId: string,
  allBooks: BibleBook[],
  startBookNumber: number
): BookTarget[] {
  const targets: BookTarget[] = [];
  const startIndex = startBookNumber - 1;

  if (startIndex < 0 || startIndex >= allBooks.length) {
    return targets;
  }

  const startBook = allBooks[startIndex];
  targets.push({
    bookNumber: startBookNumber,
    bookId: startBook.id,
    bookName: startBook.name,
  });

  for (let i = startIndex + 1; i < allBooks.length; i++) {
    const book = allBooks[i];
    const bookNum = i + 1;

    const totalChapters = book.chapters;
    const existingAudios = getExistingChapterAudioFiles(bookNum, book.id, versionId, totalChapters);
    const hasAllAudios = existingAudios.length === totalChapters && totalChapters > 0;
    const hasImage = findImageFile(bookNum, book.id, versionId) !== null;

    if (hasAllAudios && hasImage) {
      targets.push({
        bookNumber: bookNum,
        bookId: book.id,
        bookName: book.name,
      });
    } else {
      // First book that is NOT ready breaks the sequence immediately.
      break;
    }
  }

  return targets;
}

// ─── Source JSON metadata files ──────────────────────────────────────────

/**
 * Returns the path for a book's JSON metadata file in sources/metadata/<versionId>/.
 * Pattern: <NN>-<bookId>.json
 * Example: sources/metadata/rv1909/01-genesis.json
 */
export function getJsonSourcePath(
  bookNumber: number,
  bookId: string,
  versionId: string
): string {
  const base = `${padBookNumber(bookNumber)}-${bookId}.json`;
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
