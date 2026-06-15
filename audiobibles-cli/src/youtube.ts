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
 * Pattern: "<BookName> | Santa Biblia / Holy Bible | <VersionLabel> | Audio Biblia / Audio Bible"
 * Example: "Génesis | Santa Biblia | Reina Valera 1909 | Audio Biblia"
 */
function buildTitle(bookName: string, versionLabel: string, locale: string): string {
  const bibleTerm = locale === "es" ? "Santa Biblia" : "Holy Bible";
  const suffix = locale === "es" ? "Audio Biblia" : "Audio Bible";
  return `${bookName} | ${bibleTerm} | ${versionLabel} | ${suffix}`;
}

/**
 * Formats a duration in total seconds to a YouTube chapter timestamp string.
 * YouTube requires at least H:MM:SS or MM:SS format. We always use H:MM:SS.
 * Examples: 0 → "0:00:00", 75 → "0:01:15", 3661 → "1:01:01"
 */
function formatTimestamp(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Builds the chapters section for the YouTube description.
 * YouTube automatically creates chapter markers when the description contains
 * lines in the format: "H:MM:SS Label" — the first entry must start at 0:00:00.
 *
 * @param chapterDurations - Array of per-chapter durations in seconds (in order).
 * @param locale           - Used to localise the label ("Capítulo" vs "Chapter").
 */
function buildChaptersSection(
  chapterDurations: number[],
  locale: string
): string {
  const isSpanish = locale === "es";
  const label = isSpanish ? "Capítulo" : "Chapter";
  const heading = isSpanish ? "📌 Capítulos" : "📌 Chapters";

  let offset = 0;
  const lines: string[] = [heading, ""];

  for (let i = 0; i < chapterDurations.length; i++) {
    lines.push(`${formatTimestamp(offset)} ${label} ${i + 1}`);
    offset += chapterDurations[i];
  }

  return lines.join("\n");
}

/**
 * Builds the video description.
 * Structure:
 *   1. Book description
 *   2. Separator + version section
 *   3. Separator + link to book on veobible.com
 *   4. Separator + YouTube chapters (when chapterDurations are provided)
 */
function buildDescription(
  book: BibleBook,
  versionMeta: BibleVersionMetadata,
  version: BibleVersion,
  bookUrl: string,
  chapterDurations: number[]
): string {
  const separator = "\n\n";

  const isSpanish = version.locale === "es";

  const versionSection = isSpanish
    ? `📖 Sobre esta versión — ${versionMeta.name}\n\n${versionMeta.description}`
    : `📖 About this version — ${versionMeta.name}\n\n${versionMeta.description}`;

  const linkSection = isSpanish
    ? `🔗 Leer en línea\n\nEncuentra el libro de ${book.name} en ${versionMeta.name} en:\n${bookUrl}`
    : `🔗 Read online\n\nFind the book of ${book.name} in ${versionMeta.name} at:\n${bookUrl}`;

  const chaptersSection =
    chapterDurations.length > 0
      ? `${separator}${buildChaptersSection(chapterDurations, version.locale)}`
      : "";

  return `${book.description}${separator}${versionSection}${separator}${linkSection}${chaptersSection}`;
}

/**
 * Generates the YouTube upload info .txt file for a Bible book video.
 *
 * @param chapterDurations - Per-chapter audio durations in seconds (in order).
 *   When provided, a YouTube chapter markers section is appended to the
 *   description so YouTube auto-generates chapter navigation on the video.
 */
export function generateUploadInfo(params: {
  infoPath: string;
  version: BibleVersion;
  versionMeta: BibleVersionMetadata;
  book: BibleBook;
  bookNumber: number;
  bookUrl: string;
  chapterDurations?: number[];
}): void {
  const { infoPath, version, versionMeta, book, bookNumber, bookUrl, chapterDurations = [] } = params;

  const versionLabel = version.youtubeLabel || versionMeta.name;
  const title = buildTitle(book.name, versionLabel, version.locale);
  const description = buildDescription(book, versionMeta, version, bookUrl, chapterDurations);

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
