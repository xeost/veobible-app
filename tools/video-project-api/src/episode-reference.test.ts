import { test } from "node:test";
import assert from "node:assert/strict";
import { episodeReference } from "./episode-reference";
import { numberToWords } from "./engines/long/voice";
import { introTitle } from "./engines/long/episodes";
const genesis = {
  id: "genesis",
  name: "Génesis",
  versesPerChapter: [31, 25, 24, 26, 32, 22, 24],
};
const exodus = { id: "exodus", name: "Éxodo", versesPerChapter: [22] };

test("episode references omit verses only for complete chapters and group consecutive complete chapters", () => {
  const reference = episodeReference(
    [
      { book: genesis, chapter: 4, first: 1, last: 26 },
      { book: genesis, chapter: 5, first: 1, last: 32 },
      { book: genesis, chapter: 6, first: 1, last: 22 },
      { book: genesis, chapter: 7, first: 1, last: 12 },
    ],
    "es",
    (n) => numberToWords("es", n),
  );
  assert.equal(reference.start, "capítulo cuatro");
  assert.equal(reference.end, "capítulo siete, versículo doce");
  assert.equal(reference.display, "Génesis 4–6; 7:1–12");
  assert.equal(
    reference.spoken,
    "Génesis, capítulos cuatro al siete, versículo doce",
  );
});

test("single full chapters and cross-book partial chapters work in every narration language", () => {
  for (const locale of ["en", "es", "pt"] as const) {
    const words = (n: number) => numberToWords(locale, n);
    const full = episodeReference(
      [{ book: genesis, chapter: 1, first: 1, last: 31 }],
      locale,
      words,
    );
    assert.equal(full.display, "Génesis 1");
    assert.doesNotMatch(full.spoken, /verse|versículo|\d/);
    const cross = episodeReference(
      [
        { book: genesis, chapter: 7, first: 13, last: 24 },
        { book: exodus, chapter: 1, first: 1, last: 22 },
      ],
      locale,
      words,
    );
    assert.equal(cross.display, "Génesis 7:13–24 · Éxodo 1");
    assert.ok(
      cross.spoken.includes(words(13)) && cross.spoken.includes(words(24)),
    );
    assert.doesNotMatch(cross.spoken.split("Éxodo")[1], /verse|versículo|\d/);
    assert.doesNotMatch(cross.spoken, /\d/);
    const title = introTitle(locale, full.display, "Bible version", 365);
    assert.equal(title.version, "Bible version");
    assert.equal(title.episode, 365);
    assert.equal(
      title.dayLabel,
      locale === "en" ? "Day" : locale === "es" ? "Día" : "Dia",
    );
  }
});

test("long intro and outro references compact the final partial chapter in every language", () => {
  const matthew = {
    id: "matthew",
    name: "Mateo",
    versesPerChapter: [25, 23, 17, 25],
  };
  const ranges = [
    { book: matthew, chapter: 1, first: 1, last: 25 },
    { book: matthew, chapter: 2, first: 1, last: 23 },
    { book: matthew, chapter: 3, first: 1, last: 17 },
    { book: matthew, chapter: 4, first: 1, last: 17 },
  ];
  const expected = {
    es: "Mateo, capítulos uno al cuatro, versículo diecisiete",
    en: "Mateo, chapters one to four, verse seventeen",
    pt: "Mateo, capítulos um a quatro, versículo dezessete",
  };
  for (const locale of ["es", "en", "pt"] as const) {
    const reference = episodeReference(ranges, locale, (n) =>
      numberToWords(locale, n),
    );
    assert.equal(reference.spoken, expected[locale]);
    assert.equal(reference.display, "Mateo 1–3; 4:1–17");
    const full = episodeReference(
      [...ranges.slice(0, -1), { ...ranges[3], last: 25 }],
      locale,
      (n) => numberToWords(locale, n),
    );
    assert.doesNotMatch(full.spoken, /verse|versículo/);
    const partialOnly = episodeReference([ranges[3]], locale, (n) =>
      numberToWords(locale, n),
    );
    assert.ok(partialOnly.spoken.includes(numberToWords(locale, 1)));
    assert.ok(partialOnly.spoken.includes(numberToWords(locale, 17)));
  }
});
