/**
 * Step 2 — Verify that all source files are ready.
 *
 * For each targeted book, checks:
 *   - All chapter MP3/M4A audio files (by count from the Bible index)
 *   - The book thumbnail image
 *
 * Displays a readiness table and loops until all files are present
 * or the user cancels.
 */
import { readBibleIndex } from "../bible.js";
import { checkReadiness, resolveContiguousTargets } from "../filesystem.js";
import { printStep, printReadinessTable, ok, warn, info, C, showNumberedMenu } from "../ui.js";
import { logStep, log } from "../logger.js";
import type { SessionState } from "../types.js";

export async function runStep2(session: SessionState): Promise<void> {
  printStep(2, "Verify Source Files");

  const index = readBibleIndex(session.version);

  const chaptersPerBook: Record<string, number> = {};
  for (const book of index.books) {
    chaptersPerBook[book.id] = book.chapters;
  }

  while (true) {
    // If in contiguous book mode, dynamically re-resolve targets from the filesystem
    let activeTargets = session.targets;
    if (session.mode === "book" && session.continueContiguous) {
      activeTargets = resolveContiguousTargets(session.version.id, index.books, session.defaultBook);
      session.targets = activeTargets;
    }

    if (activeTargets.length === 0) {
      warn("No target books configured.");
      return;
    }

    const results = checkReadiness(activeTargets, session.version.id, chaptersPerBook);
    printReadinessTable(results);

    const allReady = results.every((r) => r.ready);

    if (session.mode === "book" && session.continueContiguous) {
      const nextBookNum = session.defaultBook + activeTargets.length;
      if (nextBookNum <= index.books.length) {
        const nextBook = index.books[nextBookNum - 1];
        info(
          `Contiguous scan halted at ${C.primary.bold(
            `${String(nextBookNum).padStart(2, "0")}. ${nextBook.name}`
          )} (missing source files).`
        );
      }
    }

    if (allReady) {
      ok("All source files are present and ready for video generation.");
      logStep(2, "Readiness check passed. All files present.");
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
    console.log(C.muted("    Pattern: <NN>-<bookId>-<chapter>.<ext> (.mp3 or .m4a)"));
    console.log(C.muted("    Example: 01-genesis-1.mp3 or 01-genesis-1.m4a … 01-genesis-50.mp3"));
    console.log();
    console.log(C.white("  Image files must be placed in:"));
    console.log(C.muted(`    sources/images/${session.version.id}/`));
    console.log(C.muted("    Pattern: <NN>-<bookId>.<ext>"));
    console.log(C.muted("    Example: 01-genesis.jpeg"));

    const retry = await showNumberedMenu<boolean>(
      "Re-check the directory?",
      [{ label: "Re-check source files", value: true }],
      "Back to Main Menu"
    );

    if (retry === null) {
      log("WARN", "User cancelled readiness check.");
      return;
    }
  }
}
