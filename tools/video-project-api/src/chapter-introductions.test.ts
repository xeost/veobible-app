import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chapterIntroductionText,
  insertChapterIntroductions,
} from "./chapter-introductions";
import { numberToWords } from "./engines/long/voice";
import { buildVerseReading } from "./reading-timeline";
import { verseAnimationSpans } from "./verse-animation";

test("complete and partial chapter scripts use spoken numbers in each Bible language", () => {
  for (const locale of ["en", "es", "pt"] as const) {
    const words = (n: number) => numberToWords(locale, n);
    const full = chapterIntroductionText(
      locale,
      { chapter: 7, first: 1, last: 22, total: 22 },
      words,
    );
    assert.equal(full.title, locale === "en" ? "Chapter 7" : "Capítulo 7");
    assert.equal(
      full.script,
      `${locale === "en" ? "Chapter" : "Capítulo"} ${words(7)}.`,
    );
    const partial = chapterIntroductionText(
      locale,
      { chapter: 7, first: 13, last: 22, total: 22 },
      words,
    );
    assert.match(partial.title, /13–22/);
    assert.ok(
      partial.script.includes(words(13)) && partial.script.includes(words(22)),
    );
    assert.doesNotMatch(partial.script, /\d/);
    const single = chapterIntroductionText(
      locale,
      { chapter: 7, first: 13, last: 13, total: 22 },
      words,
    );
    assert.doesNotMatch(single.title, /13–13/);
  }
});

test("chapter introductions preserve trimmed sources and finish before the next verse enters", () => {
  const cuts = [
    { reference: "Genesis 1:1", text: "first", start: 1, end: 3 },
    { reference: "Exodus 1:1", text: "second", start: 6, end: 8 },
  ];
  const base = buildVerseReading(
    [
      { file: "genesis.mp3", start: 10, end: 15 },
      { file: "exodus.mp3", start: 20, end: 25 },
    ],
    cuts,
    [1, 1],
  );
  const reading = insertChapterIntroductions(
    base,
    cuts.map((cue, i) => ({
      part: `chapter-${i}` as const,
      chapter: 1,
      complete: true,
      bookName: i === 0 ? "Genesis" : "Exodus",
      title: "Chapter 1",
      script: "Chapter one.",
      references: [cue.reference],
      file: `${i}.wav`,
      duration: 2,
    })),
    [1, 1],
  );
  assert.equal(reading.chapters.length, 2);
  assert.deepEqual(
    reading.sections.map(({ file, start, end }) => ({ file, start, end })),
    base.sections.map(({ file, start, end }) => ({ file, start, end })),
  );
  reading.cues.forEach((cue, i) => {
    assert.ok(
      Math.abs(cue.end - cue.start - (cuts[i].end - cuts[i].start)) < 1e-6,
    );
    const entrance = verseAnimationSpans(cue.end - cue.start, 1).entrance;
    assert.ok(
      cue.start - entrance >=
        reading.chapters[i].start + reading.chapters[i].duration + 1 - 1e-6,
    );
    assert.equal(reading.sections[i].timelineStart, cue.start);
    if (i) assert.ok(reading.chapters[i].start > reading.cues[i - 1].end);
  });
  assert.equal(reading.duration, reading.cues.at(-1)!.end);
});
