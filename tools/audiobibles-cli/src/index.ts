#!/usr/bin/env node
/**
 * Entry point for the Audiobibles CLI.
 */
import { printBanner, ok, divider, C, info, clearScreen, showNumberedMenu, pressAnyKey } from "./ui.js";
import { purgeOldLogs, log } from "./logger.js";
import { runStep0 } from "./steps/step0-setup.js";
import { runStep1 } from "./steps/step1-image-prompt.js";
import { runStep2 } from "./steps/step2-verify.js";
import { runStep3 } from "./steps/step3-generate.js";
import { runStep4 } from "./steps/step4-normalize.js";
import type { SessionState } from "./types.js";

// ── Menu items ────────────────────────────────────────────────────────────────

const STEP_ITEMS = [
  { label: "Copy Image Prompts (Gemini)",   value: 1 },
  { label: "Verify Source Files",           value: 2 },
  { label: "Generate Videos (FFmpeg)",      value: 3 },
  { label: "Normalize Audio Filenames",     value: 4 },
  { label: "Change Bible Version / Scope",  value: 5 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getScopeLabel(session: SessionState): string {
  if (session.mode === "all-books") return "All Books (1 video per book)";
  if (session.mode === "old-testament") return "Old Testament (single video)";
  if (session.mode === "new-testament") return "New Testament (single video)";
  if (session.mode === "full-bible") return "Complete Bible (single video)";
  const startBook = session.targets[0]?.bookName ?? `Book ${session.defaultBook}`;
  if (session.continueContiguous) {
    return `Book ${session.defaultBook} (${startBook}) + contiguous continuation`;
  }
  return `Book ${session.defaultBook} (${startBook})`;
}

function printMainMenuHeader(versionLabel: string, scopeLabel: string): void {
  clearScreen();
  printBanner();
  console.log();
  console.log(C.muted("  Version: ") + C.accent.bold(versionLabel));
  console.log(C.muted("  Scope:   ") + C.accent.bold(scopeLabel));
  console.log();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Clear the terminal once at startup before step 0 runs.
  clearScreen();

  purgeOldLogs();
  log("INFO", "=== Audiobibles CLI Session Started ===");

  const args = process.argv.slice(2);
  let defaultBookArg: number | undefined;
  const bookIndex = args.indexOf("--book");
  if (bookIndex !== -1 && args.length > bookIndex + 1) {
    const num = parseInt(args[bookIndex + 1], 10);
    if (!isNaN(num)) defaultBookArg = num;
  }

  try {
    // ── Step 0: version + scope selection ──────────────────────────────────
    let session = await runStep0(defaultBookArg);

    let exitRequested = false;

    while (!exitRequested) {
      const scopeLabel = getScopeLabel(session);

      // Always clear the screen and show the banner before each menu loop.
      printMainMenuHeader(session.version.label, scopeLabel);

      // showNumberedMenu erases itself when the user confirms a selection.
      const choice = await showNumberedMenu<number>(
        "Main Menu — Choose the next step:",
        STEP_ITEMS,
        "Exit program"
      );

      if (choice === null) {
        exitRequested = true;
        break;
      }

      if (choice === 5) {
        // Change Bible Version / Scope
        try {
          session = await runStep0();
        } catch (err) {
          // If cancelled during change, keep current session
        }
        continue;
      }

      try {
        switch (choice) {
          case 1: await runStep1(session); break;
          case 2: await runStep2(session); break;
          case 3: await runStep3(session); break;
          case 4: await runStep4(session); break;
        }
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.includes("cancelled") || error.message.includes("User force closed"))
        ) {
          log("WARN", `Step ${choice} cancelled by user.`);
        } else {
          const msg = error instanceof Error ? error.message : String(error);
          log("ERROR", `Step ${choice} failed: ${msg}`);
        }
      }

      // Let the user read the step output before the screen clears for the menu.
      divider();
      info(`Finished Step ${choice}. Returning to menu...`);
      await pressAnyKey();
    }

    clearScreen();
    printBanner();
    console.log();
    ok("Exiting CLI. Have a great day!");
    log("INFO", "=== Audiobibles CLI Session Ended ===");

  } catch (error) {
    if (error instanceof Error && (error.message.includes("cancelled") || error.message.includes("User force closed"))) {
      clearScreen();
      printBanner();
      console.log();
      ok("Exiting CLI. Have a great day!");
      log("INFO", "=== Audiobibles CLI Session Ended ===");
      process.exit(0);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("\nAn unexpected error occurred:");
      console.error(msg);
      log("ERROR", `Unhandled exception: ${error instanceof Error ? error.stack || msg : msg}`);
      process.exit(1);
    }
  }
}

main();
