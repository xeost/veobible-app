// ─── Bible version ────────────────────────────────────────────────────────────

export interface BibleVersion {
  id: string;
  locale: string;
  label: string;
  shortLabel: string;
  /** Optional custom label to be used in the generated YouTube video title instead of the index version name */
  youtubeLabel?: string;
}

// ─── Bible index (mirrors frontend/public/bible-data/<locale>/<id>/index.json) ─────────

export interface BibleVersionMetadata {
  name: string;
  shortname: string;
  slug: string;
  year: string;
  language: string;
  copyright: string;
  description: string;
}

export interface BibleBook {
  /** English lowercase id used for filenames (e.g. "genesis", "1-samuel") */
  id: string;
  /** Localised display name (e.g. "Génesis" / "Genesis") */
  name: string;
  /** URL slug used on the website (may be localised, e.g. "exodo", "josue") */
  slug: string;
  abbr: string;
  testament: "old" | "new";
  /** Total number of chapters in this book */
  chapters: number;
  versesPerChapter: number[];
  /** Short description of the book's contents */
  description: string;
  /**
   * YouTube video URL for the full audio-bible of this book.
   * e.g. "https://www.youtube.com/watch?v=zBwWW2mVMNs"
   * Empty string until the video is published.
   */
  video: string;
  /**
   * Start time (in whole seconds) of each chapter within the YouTube video.
   * Element index 0 = Chapter 1 (always 0), index 1 = Chapter 2, etc.
   * Use to build deep-link URLs like:
   *   `${video}&t=${chapterOffsets[chapterIndex]}s`
   * Populated automatically by the audiobibles-cli Step 4.
   */
  chapterOffsets: number[];
}

export interface BibleIndex {
  metadata: BibleVersionMetadata;
  books: BibleBook[];
}

// ─── Book metadata (written to sources/metadata/<versionId>/<NN>-<bookId>.json) ──

export interface BookMetadata {
  bookNumber: number;
  bookId: string;
  bookName: string;
  versionId: string;
  versionLabel: string;
  totalChapters: number;
  description: string;
  versionDescription: string;
  bookUrl: string;
}

// ─── Session state shared across steps ────────────────────────────────────────

export interface BookTarget {
  /** 1-based position in the Bible (1 = Genesis … 66 = Revelation) */
  bookNumber: number;
  /** English lowercase id matching the audio filenames (e.g. "genesis") */
  bookId: string;
  /** Localised display name used in titles and prompts */
  bookName: string;
}

export interface SessionState {
  version: BibleVersion;
  defaultBook: number;
  targets: BookTarget[];
}
