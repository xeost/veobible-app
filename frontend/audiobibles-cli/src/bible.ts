/**
 * Bible data helpers — reads and parses the Bible version index files
 * from public/bible-data/<locale>/<versionId>/index.json.
 */
import fs from "fs";
import path from "path";
import { config } from "./config.js";
import type { BibleIndex, BibleBook, BibleVersion } from "./types.js";

/**
 * Reads and parses the index.json for the given Bible version.
 * Throws if the file is not found.
 */
export function readBibleIndex(version: BibleVersion): BibleIndex {
  const indexPath = path.join(
    config.bibleDataDir,
    version.locale,
    version.id,
    "index.json"
  );

  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Bible index not found for version "${version.id}" at: ${indexPath}`
    );
  }

  const raw = fs.readFileSync(indexPath, "utf-8");
  return JSON.parse(raw) as BibleIndex;
}

/**
 * Returns the book at the given 1-based position (e.g. 1 = Genesis).
 * Returns undefined if the position is out of range.
 */
export function getBookByNumber(
  index: BibleIndex,
  bookNumber: number
): BibleBook | undefined {
  return index.books[bookNumber - 1];
}

/**
 * Returns the 1-based position of a book by its id.
 * Returns -1 if not found.
 */
export function getBookNumber(index: BibleIndex, bookId: string): number {
  const idx = index.books.findIndex((b) => b.id === bookId);
  return idx === -1 ? -1 : idx + 1;
}

/**
 * Constructs the public URL of a Bible book on the website.
 * Pattern: https://veobible.com/<locale>/<versionId>/<bookSlug>
 */
export function buildBookUrl(version: BibleVersion, book: BibleBook): string {
  return `${config.siteBaseUrl}/${version.locale}/${version.id}/${book.slug}`;
}

/**
 * Pads a book number to two digits for use in filenames.
 * e.g. 1 → "01", 42 → "42"
 */
export function padBookNumber(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Writes the chapterOffsets array for a single book back into the
 * version's index.json on disk.
 *
 * The offsets are the cumulative start time (in whole seconds) of each
 * chapter within the full video. Chapter 1 is always 0.
 *
 * @param version       - The Bible version (used to locate the index file).
 * @param bookId        - The book id to update (e.g. "genesis").
 * @param chapterOffsets - Array of start seconds, one per chapter.
 */
export function saveChapterOffsets(
  version: BibleVersion,
  bookId: string,
  chapterOffsets: number[]
): void {
  const indexPath = path.join(
    config.bibleDataDir,
    version.locale,
    version.id,
    "index.json"
  );

  const raw = fs.readFileSync(indexPath, "utf-8");
  const data = JSON.parse(raw) as BibleIndex;

  const book = data.books.find((b) => b.id === bookId);
  if (!book) {
    throw new Error(
      `saveChapterOffsets: book "${bookId}" not found in ${indexPath}`
    );
  }

  book.chapterOffsets = chapterOffsets;

  fs.writeFileSync(indexPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
