/**
 * Step 0 — Session setup.
 * Selects the Bible version and the generation scope:
 *   - A specific book
 *   - All books individually (1 video per book)
 *   - All Old Testament books (single combined video)
 *   - All New Testament books (single combined video)
 *   - The complete Bible (single combined video)
 *
 * Each sub-menu clears the screen and shows the banner so the previous
 * menu is never visible when a new menu appears.
 */
import { input } from "@inquirer/prompts";
import { readBibleIndex } from "../bible.js";
import { clearScreen, printBanner, info, ok, warn, C, showNumberedMenu } from "../ui.js";
import { logStep } from "../logger.js";
import { getLastBook, ensureWorkingDirs } from "../filesystem.js";
import { config } from "../config.js";
import type { SessionState, BibleVersion, GenerationMode } from "../types.js";

// ── Shared header renderer ────────────────────────────────────────────────────

function printSetupHeader(subtitle?: string): void {
  clearScreen();
  printBanner();
  console.log();
  console.log(C.primary.bold("  ── Step 0 ── Session Setup"));
  if (subtitle) {
    console.log(C.muted(`  ${subtitle}`));
  }
  console.log();
}

// ── Main setup flow ───────────────────────────────────────────────────────────

export async function runStep0(defaultBookArg?: number): Promise<SessionState> {
  // ── Version selection ────────────────────────────────────────────────────
  printSetupHeader();

  const versionChoice = await showNumberedMenu<BibleVersion>(
    "Select Bible version to process:",
    config.versions.map((v) => ({
      label: `${v.label} (${v.shortLabel})`,
      value: v as BibleVersion,
    })),
    "Exit"
  );

  if (versionChoice === null) {
    throw new Error("cancelled");
  }

  const version = versionChoice;

  // ── Load Bible index ─────────────────────────────────────────────────────
  info(`Loading Bible index for ${C.primary.bold(version.label)}...`);
  const index = readBibleIndex(version);
  const totalBooks = index.books.length;
  info(`Found ${C.accent(String(totalBooks))} books.`);
  ensureWorkingDirs(version.id);

  // ── Scope selection ───────────────────────────────────────────────────────
  printSetupHeader(`Version: ${version.label}`);

  const scopeChoice = await showNumberedMenu<GenerationMode>(
    "Select the generation scope:",
    [
      { label: "Specific book",                                value: "book" as GenerationMode },
      { label: "All books (1 video per book)",                 value: "all-books" as GenerationMode },
      { label: "Old Testament (single video of all OT books)", value: "old-testament" as GenerationMode },
      { label: "New Testament (single video of all NT books)", value: "new-testament" as GenerationMode },
      { label: "Complete Bible (single video of all books)",   value: "full-bible" as GenerationMode },
    ],
    "Back (change version)"
  );

  if (scopeChoice === null) {
    // User pressed 0 — restart setup from the top (change version)
    return runStep0(defaultBookArg);
  }

  const mode = scopeChoice;

  // ── Build targets based on scope ─────────────────────────────────────────
  if (mode === "all-books") {
    const targets = index.books.map((b, i) => ({
      bookNumber: i + 1,
      bookId: b.id,
      bookName: b.name,
    }));

    ok(`Scope: ${C.primary.bold("All books (1 video per book)")} — ${C.accent(String(targets.length))} books selected.`);
    logStep(0, `Session configured. Version: ${version.id}. Scope: ${mode}. Books: ${targets.length}`);

    return {
      version,
      defaultBook: 1,
      targets,
      mode,
    };
  }

  if (mode === "old-testament" || mode === "new-testament" || mode === "full-bible") {
    const testament = mode === "old-testament" ? "old"
      : mode === "new-testament" ? "new"
      : null; // null = both

    const filteredBooks = testament
      ? index.books.filter((b) => b.testament === testament)
      : index.books;

    const targets = filteredBooks.map((b) => ({
      bookNumber: index.books.indexOf(b) + 1,
      bookId: b.id,
      bookName: b.name,
    }));

    const scopeLabel =
      mode === "old-testament" ? "Old Testament (single video)" :
      mode === "new-testament" ? "New Testament (single video)" :
      "Complete Bible (single video)";

    ok(`Scope: ${C.primary.bold(scopeLabel)} — ${C.accent(String(targets.length))} books selected.`);
    logStep(0, `Session configured. Version: ${version.id}. Scope: ${mode}. Books: ${targets.length}`);

    return {
      version,
      defaultBook: targets[0]?.bookNumber ?? 1,
      targets,
      mode,
    };
  }

  // ── Specific book ─────────────────────────────────────────────────────────
  let bookNumber: number;
  if (defaultBookArg !== undefined) {
    bookNumber = defaultBookArg;
    info(`Using --book ${bookNumber} from command-line argument.`);
  } else {
    const lastBook = getLastBook(version.id);
    const suggested = lastBook !== null ? lastBook + 1 : 1;

    const raw = await input({
      message: C.white(`Book number to process (1–${totalBooks}):`),
      default: suggested.toString(),
      validate: (v) => {
        const n = parseInt(v, 10);
        if (!Number.isInteger(n) || n < 1 || n > totalBooks) {
          return `Please enter a number between 1 and ${totalBooks}.`;
        }
        return true;
      },
    });
    bookNumber = parseInt(raw, 10);
  }

  // Verify book exists in the index
  const bookData = index.books[bookNumber - 1];
  if (!bookData) {
    throw new Error(`Book number ${bookNumber} is out of range (${totalBooks} books available).`);
  }

  ok(`Selected: ${C.primary.bold(`${String(bookNumber).padStart(2, "0")}. ${bookData.name}`)} (${bookData.chapters} chapters)`);

  logStep(0, `Session configured. Version: ${version.id}. Book: ${bookNumber} — ${bookData.name}`);

  return {
    version,
    defaultBook: bookNumber,
    targets: [
      {
        bookNumber,
        bookId: bookData.id,
        bookName: bookData.name,
      },
    ],
    mode: "book",
  };
}
