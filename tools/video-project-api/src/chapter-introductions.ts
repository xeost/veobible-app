import { verseAnimationSpans } from "./verse-animation";

export type VoicePart = "intro" | "outro" | `chapter-${number}`;
export interface ChapterIntroduction {
  part: `chapter-${number}`;
  chapter: number;
  complete: boolean;
  bookName: string;
  title: string;
  script: string;
  references: string[];
}
export interface ChapterTrack extends ChapterIntroduction {
  file: string;
  duration: number;
  start: number;
}

/** Insert chapter narration without changing any source-file verse cuts. */
export function insertChapterIntroductions<
  T extends { reference: string; start: number; end: number },
>(
  reading: {
    cues: T[];
    sections: {
      file: string;
      start: number;
      end: number;
      timelineStart: number;
    }[];
    duration: number;
  },
  introductions: Array<Omit<ChapterTrack, "start">>,
  lineCounts: number[],
) {
  let shift = 0;
  const insertions: { at: number; length: number }[] = [];
  const chapters: ChapterTrack[] = [];
  for (const intro of introductions) {
    const index = reading.cues.findIndex((cue) =>
      intro.references.includes(cue.reference),
    );
    if (index < 0) continue;
    const cue = reading.cues[index];
    const entrance = verseAnimationSpans(
      cue.end - cue.start,
      lineCounts[index],
    ).entrance;
    // The next verse's entrance follows the chapter title instead of appearing over it.
    const start = Math.max(0, cue.start - entrance) + shift;
    const length = intro.duration + 1 + Math.max(0, entrance - cue.start);
    chapters.push({ ...intro, start });
    insertions.push({ at: cue.start, length });
    shift += length;
  }
  const offset = (time: number) =>
    insertions.reduce(
      (sum, item) => sum + (time >= item.at - 1e-6 ? item.length : 0),
      0,
    );
  return {
    cues: reading.cues.map((cue) => ({
      ...cue,
      start: cue.start + offset(cue.start),
      end: cue.end + offset(cue.start),
    })),
    sections: reading.sections.map((section) => ({
      ...section,
      timelineStart: section.timelineStart + offset(section.timelineStart),
    })),
    duration: reading.duration + shift,
    chapters,
  };
}

/** Display numerals while sending fully spoken numbers to speech synthesis. */
export function chapterIntroductionText(
  locale: "en" | "es" | "pt",
  range: { chapter: number; first: number; last: number; total: number },
  words: (number: number) => string,
) {
  const complete = range.first === 1 && range.last === range.total;
  const chapter = { en: "Chapter", es: "Capítulo", pt: "Capítulo" }[locale];
  const plural = range.first !== range.last;
  const verses = plural
    ? { en: "verses", es: "versículos", pt: "versículos" }[locale]
    : { en: "verse", es: "versículo", pt: "versículo" }[locale];
  const to = { en: "to", es: "al", pt: "a" }[locale];
  const title = `${chapter} ${range.chapter}${complete ? "" : ` · ${verses} ${range.first}${plural ? `–${range.last}` : ""}`}`;
  const script = `${chapter} ${words(range.chapter)}${complete ? "" : `, ${verses} ${words(range.first)}${plural ? ` ${to} ${words(range.last)}` : ""}`}.`;
  return { title, script };
}
