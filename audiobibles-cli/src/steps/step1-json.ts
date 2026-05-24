/**
 * Step 1 — Create Book JSON metadata files.
 *
 * Writes one JSON file per targeted book to:
 *   sources/<versionId>/<NN>-<bookId>-<versionId>.json
 *
 * These files serve as a filter mechanism: after running Step 1, the user
 * can manually delete the JSON files of books they do NOT want to process.
 * Steps 2–4 will only act on books that have their JSON file present.
 */
import fs from "fs";
import { readBibleIndex, buildBookUrl, padBookNumber } from "../bible.js";
import { getJsonSourcePath, ensureWorkingDirs, sourcesJsonDir } from "../filesystem.js";
import { printStep, ok, err, info, warn } from "../ui.js";
import { logStep, log } from "../logger.js";
import type { SessionState, BookMetadata } from "../types.js";

export async function runStep1(session: SessionState): Promise<void> {
  printStep(1, "Create Book JSON Files");
  ensureWorkingDirs(session.version.id);

  const index = readBibleIndex(session.version);

  let written = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of session.targets) {
    const bookData = index.books.find((b) => b.id === target.bookId);

    if (!bookData) {
      warn(`Book "${target.bookId}" not found in Bible index — skipping.`);
      failed++;
      continue;
    }

    const bookUrl = buildBookUrl(session.version, bookData);

    const metadata: BookMetadata = {
      bookNumber: target.bookNumber,
      bookId: target.bookId,
      bookName: target.bookName,
      versionId: session.version.id,
      versionLabel: session.version.label,
      totalChapters: bookData.chapters,
      description: bookData.description,
      versionDescription: index.metadata.description,
      bookUrl,
    };

    const outPath = getJsonSourcePath(target.bookNumber, target.bookId, session.version.id);

    try {
      fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2), "utf-8");
      ok(`Written → ${padBookNumber(target.bookNumber)}-${target.bookId}-${session.version.id}.json`);
      info(`  ${target.bookName} — ${bookData.chapters} chapters`);
      info(`  URL: ${bookUrl}`);
      log("INFO", `[${target.bookId}] JSON written: ${outPath}`);
      written++;
    } catch (e) {
      err(`Failed to write JSON for ${target.bookId}: ${e}`);
      log("ERROR", `[${target.bookId}] JSON write failed: ${e}`);
      failed++;
    }
  }

  logStep(1, `Book JSON files created: ${written} written, ${skipped} skipped, ${failed} failed.`);

  if (written > 0) {
    info("");
    info(`JSON files are in: ${sourcesJsonDir(session.version.id)}`);
    info("To exclude a book from processing, delete its JSON file before running Steps 2–4.");
  }
}
