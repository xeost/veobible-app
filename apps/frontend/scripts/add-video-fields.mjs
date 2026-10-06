#!/usr/bin/env node
/**
 * add-video-fields.mjs
 *
 * Adds the following fields to every book entry in all Bible version
 * index.json files found under public/bible-data/:
 *
 *   "video": ""
 *     → YouTube video URL for the full audio-bible of that book.
 *       e.g. "https://www.youtube.com/watch?v=zBwWW2mVMNs"
 *       Fill this in manually once the video is published.
 *
 *   "chapterOffsets": []
 *     → Array of integers (seconds) representing the start time of each
 *       chapter within the YouTube video. Element 0 is always 0 (Chapter 1
 *       starts at the beginning). Populated automatically by the
 *       audiobibles-cli Step 4 after probing the chapter MP3 durations.
 *       Use to build deep-link URLs like:
 *       https://www.youtube.com/watch?v=zBwWW2mVMNs&t=351s
 *
 * Usage:
 *   node scripts/add-video-fields.mjs
 *
 * Run from the project root (veobible-app/).
 * Safe to re-run: existing non-empty values are preserved.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bibleDataDir = path.resolve(__dirname, "..", "public", "bible-data");

let totalVersions = 0;
let totalBooks = 0;

// Walk locale/ version/ pairs
for (const locale of fs.readdirSync(bibleDataDir)) {
  const localeDir = path.join(bibleDataDir, locale);
  if (!fs.statSync(localeDir).isDirectory()) continue;

  for (const versionId of fs.readdirSync(localeDir)) {
    const indexPath = path.join(localeDir, versionId, "index.json");
    if (!fs.existsSync(indexPath)) continue;

    const raw = fs.readFileSync(indexPath, "utf-8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data.books)) {
      console.warn(`  ⚠ No books array in ${indexPath} — skipping.`);
      continue;
    }

    let modified = false;

    for (const book of data.books) {
      // Add "video" only if missing (never overwrite an existing URL)
      if (!("video" in book)) {
        book.video = "";
        modified = true;
      }

      // Add "chapterOffsets" only if missing
      if (!("chapterOffsets" in book)) {
        book.chapterOffsets = [];
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(indexPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
      console.log(`✔ ${locale}/${versionId}/index.json — updated ${data.books.length} books`);
    } else {
      console.log(`– ${locale}/${versionId}/index.json — already up to date`);
    }

    totalVersions++;
    totalBooks += data.books.length;
  }
}

console.log(`\nDone. ${totalVersions} version(s), ${totalBooks} book(s) processed.`);
