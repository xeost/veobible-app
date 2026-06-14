/**
 * Step 0 — Session setup.
 * Selects the Bible version and the specific book to process.
 * All subsequent steps will work exclusively on this single book.
 */
import { input, select } from "@inquirer/prompts";
import { readBibleIndex } from "../bible.js";
import { printStep, info, ok, C } from "../ui.js";
import { logStep } from "../logger.js";
import { getLastBook, ensureWorkingDirs } from "../filesystem.js";
import { config } from "../config.js";
import type { SessionState, BibleVersion } from "../types.js";

export async function runStep0(defaultBookArg?: number): Promise<SessionState> {
  printStep(0, "Session Setup");

  // ── Select Bible version ─────────────────────────────────────────────────
  const version = await select<BibleVersion>({
    message: C.white("Select Bible version to process:"),
    choices: config.versions.map((v) => ({
      name: `${v.label} (${v.shortLabel})`,
      value: v,
    })),
  });

  // ── Load Bible index ─────────────────────────────────────────────────────
  info(`Loading Bible index for ${C.primary.bold(version.label)}...`);
  const index = readBibleIndex(version);
  const totalBooks = index.books.length;
  info(`Found ${C.accent(String(totalBooks))} books.`);

  // Ensure working directories exist for this version
  ensureWorkingDirs(version.id);

  // ── Select book number ───────────────────────────────────────────────────
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
  };
}
