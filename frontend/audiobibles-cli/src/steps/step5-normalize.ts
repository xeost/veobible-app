/**
 * Step 5 — Normalize Audio Filenames.
 *
 * Recursively traverses the audio directory of the current version and renames
 * any .mp3 file whose name does not exactly match the canonical format:
 *   [NN]-[text]-[N].mp3
 */
import fs from "fs";
import path from "path";
import { confirm } from "@inquirer/prompts";
import { sourcesAudiosDir } from "../filesystem.js";
import { printStep, ok, err, info, warn, C, divider } from "../ui.js";
import { logStep, log } from "../logger.js";
import type { SessionState } from "../types.js";

// Matches the canonical format exactly: NN-text-N.mp3
// The middle segment (text) can start with an optional digit followed by a hyphen (e.g. "1-samuel").
const CANONICAL_RE = /^(\d{2,})-((?:[1-9]-)?(?:[a-z][a-z0-9-]*[a-z0-9]|[a-z]))-(\d+)\.mp3$/i;

// Captures a canonical-looking prefix at the start of any filename.
// The first number must be at least 2 digits (zero-padded).
// The middle text can start with an optional digit and hyphen, followed by letters/hyphens/digits.
// The trailing chapter number has no leading zeros.
const PREFIX_RE = /^(\d{2,})-((?:[1-9]-)?(?:[a-z][a-z0-9-]*[a-z0-9]|[a-z]))-(0*([1-9]\d*))(?=[-.])/i;

function canonicalName(bookNum: string, bookText: string, chapterNum: string): string {
  // Ensure book number is zero-padded to at least 2 digits.
  const padded = String(parseInt(bookNum, 10)).padStart(2, "0");
  // Ensure chapter number has no leading zeros.
  const chapter = String(parseInt(chapterNum, 10));
  return `${padded}-${bookText.toLowerCase()}-${chapter}.mp3`;
}

interface ProcessStats {
  alreadyOk: number;
  renamed: number;
  skipped: number;
  errors: number;
}

export async function runStep5(session: SessionState): Promise<void> {
  printStep(5, "Normalize Audio Filenames");

  const rootDir = sourcesAudiosDir(session.version.id);

  if (!fs.existsSync(rootDir)) {
    warn(`Audio directory does not exist: ${rootDir}`);
    return;
  }

  info(`Target directory: ${C.primary.bold(rootDir)}`);

  const dryRun = await confirm({
    message: C.white("Run in dry-run mode (preview changes without renaming)?"),
    default: true,
  });

  const modeLabel = dryRun ? " (DRY RUN — no files will be changed)" : "";
  info(`Traversing: ${rootDir}${modeLabel}`);
  divider();

  const stats: ProcessStats = {
    alreadyOk: 0,
    renamed: 0,
    skipped: 0,
    errors: 0,
  };

  function processDir(currentDir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      err(`Failed to read directory: ${currentDir}. Error: ${e}`);
      stats.errors++;
      return;
    }

    // Sort filenames for deterministic ordering
    const files = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".mp3"))
      .map((e) => e.name)
      .sort();

    for (const filename of files) {
      const filepath = path.join(currentDir, filename);

      // Already matches canonical format — nothing to do.
      if (CANONICAL_RE.test(filename)) {
        stats.alreadyOk++;
        continue;
      }

      // Try to extract the canonical prefix from the filename.
      const match = PREFIX_RE.exec(filename);
      if (!match) {
        console.log(`  [SKIP] No canonical prefix found: ${filepath}`);
        stats.skipped++;
        continue;
      }

      const bookNum = match[1];
      const bookText = match[2];
      const chapterNum = match[4]; // group 4 strips leading zeros

      const newName = canonicalName(bookNum, bookText, chapterNum);
      const newPath = path.join(currentDir, newName);

      if (newName === filename) {
        // Should not happen, but guard anyway
        stats.alreadyOk++;
        continue;
      }

      // Avoid overwriting an existing file.
      if (fs.existsSync(newPath)) {
        console.log(`  [ERROR] Target already exists, skipping: ${newPath}`);
        stats.errors++;
        continue;
      }

      const action = dryRun ? "Would rename" : "Renaming";
      console.log(`  [${action}] '${filename}'  →  '${newName}'`);
      console.log(`            in ${currentDir}`);

      if (!dryRun) {
        try {
          fs.renameSync(filepath, newPath);
          stats.renamed++;
        } catch (exc) {
          console.log(`  [ERROR] Failed to rename: ${exc}`);
          stats.errors++;
        }
      } else {
        stats.renamed++;
      }
    }

    // Recurse into subdirectories
    const subdirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const subdir of subdirs) {
      processDir(path.join(currentDir, subdir));
    }
  }

  processDir(rootDir);

  // Summary
  const mode = dryRun ? " (dry run)" : "";
  divider();
  ok(`Done${mode}:`);
  info(`Already canonical : ${stats.alreadyOk}`);
  info(`Renamed           : ${stats.renamed}`);
  info(`Skipped (no match): ${stats.skipped}`);
  info(`Errors            : ${stats.errors}`);

  logStep(
    5,
    `Filename normalization completed: ${stats.alreadyOk} already ok, ${stats.renamed} renamed, ${stats.skipped} skipped, ${stats.errors} errors.`
  );
}
