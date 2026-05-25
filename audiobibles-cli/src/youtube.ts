import fs from "fs";
import path from "path";
import { config } from "./config.js";
import { log } from "./logger.js";
import type { BibleVersion, BibleBook, BibleVersionMetadata } from "./types.js";

const DAY_MAP: Record<string, number> = {
  // English names
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  // Spanish names
  domingo: 0, dom: 0,
  lunes: 1, lun: 1,
  martes: 2, mar: 2,
  miércoles: 3, miercoles: 3, mie: 3,
  jueves: 4, jue: 4,
  viernes: 5, vie: 5,
  sábado: 6, sabado: 6, sab: 6,
};

function parsePublishDays(publishDays: readonly (string | number)[] | string): Set<number> {
  const result = new Set<number>();

  const processItem = (item: unknown) => {
    if (typeof item === "number") {
      if (item >= 0 && item <= 6) {
        result.add(item);
      }
    } else if (typeof item === "string") {
      const clean = item.trim().toLowerCase();
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num >= 0 && num <= 6) {
        result.add(num);
      } else if (clean in DAY_MAP) {
        result.add(DAY_MAP[clean]);
      }
    }
  };

  if (Array.isArray(publishDays)) {
    publishDays.forEach(processItem);
  } else if (typeof publishDays === "string") {
    publishDays.split(",").forEach(processItem);
  }

  // Fallback to all days if empty or invalid to prevent infinite loops
  if (result.size === 0) {
    for (let i = 0; i < 7; i++) {
      result.add(i);
    }
  }

  return result;
}

/**
 * Calculates the scheduled date for a given book number within a version.
 * Book 1 is scheduled on the first available publish day on or after config.schedule.baseDate;
 * each subsequent book is scheduled on the next available publish day.
 */
function getScheduledDate(bookNumber: number): string {
  const base = new Date(`${config.schedule.baseDate}T00:00:00`);
  const publishDayNums = parsePublishDays(config.schedule.publishDays);

  let currentDate = new Date(base.getTime());

  // Find first publish day on or after baseDate
  while (!publishDayNums.has(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Advance for subsequent books
  for (let i = 1; i < bookNumber; i++) {
    currentDate.setDate(currentDate.getDate() + 1);
    while (!publishDayNums.has(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return currentDate.toLocaleDateString("en-US", {
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
