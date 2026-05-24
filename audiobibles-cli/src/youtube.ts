import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { log } from "./logger.js";
import type { BibleVersion, BibleBook, BibleVersionMetadata } from "./types.js";

/**
 * Calculates the scheduled date for a given book number within a version.
 * Book 1 is scheduled on config.schedule.baseDate;
 * each subsequent book adds daysPerBook days.
 */
function getScheduledDate(bookNumber: number): string {
  const base = new Date(`${config.schedule.baseDate}T00:00:00`);
  base.setDate(base.getDate() + (bookNumber - 1) * config.schedule.daysPerBook);
  return base.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Upload info template ─────────────────────────────────────────────────────

const UPLOAD_INFO_TEMPLATE = `\
══════════════════════════════════════════════════
{versionLabel} — {bookName}
══════════════════════════════════════════════════

TITLE
-----
{title}

DESCRIPTION
-----------
{description}

SCHEDULED TIME
--------------
{date}
{time}

══════════════════════════════════════════════════
`;

/**
 * Builds the video title for a Bible book.
 * Pattern: "<BookName> | <VersionLabel>"
 * Example: "Génesis | Reina Valera 1909"
 */
function buildTitle(bookName: string, versionLabel: string): string {
  return `${bookName} | ${versionLabel}`;
}

/**
 * Builds the video description.
 * Structure:
 *   1. Book description
 *   2. Separator + version section
 *   3. Separator + link to book on veobible.com
 */
function buildDescription(
  book: BibleBook,
  versionMeta: BibleVersionMetadata,
  version: BibleVersion,
  bookUrl: string
): string {
  const separator = "\n\n─────────────────────────────────\n\n";

  const isSpanish = version.locale === "es";

  const versionSection = isSpanish
    ? `📖 Sobre esta versión — ${versionMeta.name}\n\n${versionMeta.description}`
    : `📖 About this version — ${versionMeta.name}\n\n${versionMeta.description}`;

  const linkSection = isSpanish
    ? `🔗 Leer en línea\n\nSigue el libro de ${book.name} en ${versionMeta.name} en:\n${bookUrl}`
    : `🔗 Read online\n\nFollow the book of ${book.name} in ${versionMeta.name} at:\n${bookUrl}`;

  return `${book.description}${separator}${versionSection}${separator}${linkSection}`;
}

/**
 * Generates the YouTube upload info .txt file for a Bible book video.
 */
export function generateUploadInfo(params: {
  infoPath: string;
  version: BibleVersion;
  versionMeta: BibleVersionMetadata;
  book: BibleBook;
  bookNumber: number;
  bookUrl: string;
}): void {
  const { infoPath, version, versionMeta, book, bookNumber, bookUrl } = params;

  const title = buildTitle(book.name, versionMeta.name);
  const description = buildDescription(book, versionMeta, version, bookUrl);

  const content = UPLOAD_INFO_TEMPLATE
    .replaceAll("{versionLabel}", versionMeta.shortname)
    .replaceAll("{bookName}", book.name)
    .replaceAll("{title}", title)
    .replaceAll("{description}", description)
    .replaceAll("{date}", getScheduledDate(bookNumber))
    .replaceAll("{time}", config.schedule.scheduledTime);

  fs.writeFileSync(infoPath, content, "utf-8");
  log("INFO", `Upload info written: ${infoPath}`);
}
