/**
 * Step 3 — Verify that all source files are ready.
 *
 * Only checks books that have their JSON metadata file in sources/<versionId>/
 * (i.e., those not deleted after Step 1).
 *
 * For each filtered book, checks:
 *   - All chapter MP3 audio files (by count from the Bible index)
 *   - The book thumbnail image
 *
 * Displays a readiness table and loops until all files are present
 * or the user cancels.
 */
import { confirm } from "@inquirer/prompts";
import { readBibleIndex } from "../bible.js";
import { checkReadiness, filterTargetsByJson } from "../filesystem.js";
import { printStep, printReadinessTable, ok, warn, C } from "../ui.js";
import { logStep, log } from "../logger.js";
import type { SessionState } from "../types.js";

export async function runStep3(session: SessionState): Promise<void> {
  printStep(3, "Verify Source Files");

  // Only check books that have a JSON metadata file
  const filteredTargets = filterTargetsByJson(session.targets, session.version.id);

  if (filteredTargets.length === 0) {
    warn("No books with JSON metadata files found. Run Step 1 first.");
    return;
  }

  const index = readBibleIndex(session.version);

  const chaptersPerBook: Record<string, number> = {};
  for (const book of index.books) {
    chaptersPerBook[book.id] = book.chapters;
  }

  while (true) {
    const results = checkReadiness(filteredTargets, session.version.id, chaptersPerBook);
    printReadinessTable(results);

    const allReady = results.every((r) => r.ready);

    if (allReady) {
      ok("All source files are present and ready for video generation.");
      logStep(3, "Readiness check passed. All files present.");
      break;
    }

    const missingInfo = results
      .filter((r) => !r.ready)
      .map((r) => {
        const parts: string[] = [];
        if (!r.hasAudios) {
          parts.push(
            r.missingChapters.length === chaptersPerBook[r.bookId]
              ? `All ${chaptersPerBook[r.bookId]} audio chapters missing`
              : `Missing chapters: ${r.missingChapters.join(", ")}`
          );
        }
        if (!r.hasImage) parts.push("Image missing");
        return `  ${C.primary.bold(r.label)}: ${parts.join(", ")}`;
      });

    warn("Some source files are missing:");
    for (const line of missingInfo) {
      console.log(line);
    }

    console.log();
    console.log(C.white("  Audio files must be placed in:"));
    console.log(C.muted(`    sources/audios/${session.version.id}/`));
    console.log(C.muted("    Pattern: <NN>-<bookId>-<chapter>.mp3"));
    console.log(C.muted("    Example: 01-genesis-1.mp3 … 01-genesis-50.mp3"));
    console.log();
    console.log(C.white("  Image files must be placed in:"));
    console.log(C.muted("    sources/images/"));
    console.log(C.muted("    Pattern: <NN>-<bookId>-<versionId>.<ext>"));
    console.log(C.muted(`    Example: 01-genesis-${session.version.id}.jpeg`));

    const retry = await confirm({
      message: C.white("Press Enter to re-check the directory"),
      default: true,
    });

    if (!retry) {
      log("WARN", "User cancelled readiness check.");
      return;
    }
  }
}
