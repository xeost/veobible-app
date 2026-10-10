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
  assert.equal(reference.end, "capítulo siete versículo doce");
  assert.equal(reference.display, "Génesis 4–6; 7:1–12");
  assert.equal(
    reference.spoken,
    "Génesis desde el capítulo cuatro al capítulo siete versículo doce",
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
    assert.ok(cross.spoken.includes(words(13)));
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
    es: "Mateo desde el capítulo uno al capítulo cuatro versículo diecisiete",
    en: "Mateo from chapter one to chapter four verse seventeen",
    pt: "Mateo do capítulo um ao capítulo quatro versículo dezessete",
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
    assert.doesNotMatch(
      partialOnly.spoken,
      /verse one|versículo uno|versículo um/,
    );
    assert.ok(partialOnly.spoken.includes(numberToWords(locale, 17)));
  }
});

test("long narration states only incomplete endpoints in Spanish, English and Portuguese", async () => {
  const { renderVoiceScripts } = await import("./engines/long/voice");
  const sizes = [
    31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33,
  ];
  const cases = [
    {
      start: 4,
      first: 1,
      end: 7,
      last: 12,
      expected: {
        es: "Génesis desde el capítulo cuatro al capítulo siete versículo doce",
        en: "Genesis from chapter four to chapter seven verse twelve",
        pt: "Gênesis do capítulo quatro ao capítulo sete versículo doze",
      },
    },
    {
      start: 7,
      first: 13,
      end: 10,
      last: 32,
      expected: {
        es: "Génesis desde el capítulo siete versículo trece al capítulo diez",
        en: "Genesis from chapter seven verse thirteen to chapter ten",
        pt: "Gênesis do capítulo sete versículo treze ao capítulo dez",
      },
    },
    {
      start: 14,
      first: 21,
      end: 18,
      last: 15,
      expected: {
        es: "Génesis desde el capítulo catorce versículo veintiuno al capítulo dieciocho versículo quince",
        en: "Genesis from chapter fourteen verse twenty-one to chapter eighteen verse fifteen",
        pt: "Gênesis do capítulo catorze versículo vinte e um ao capítulo dezoito versículo quinze",
      },
    },
    {
      start: 1,
      first: 1,
      end: 3,
      last: 24,
      expected: {
        es: "Génesis desde el capítulo uno al capítulo tres",
        en: "Genesis from chapter one to chapter three",
        pt: "Gênesis do capítulo um ao capítulo três",
      },
    },
  ];
  for (const locale of ["es", "en", "pt"] as const) {
    const book = {
      id: "genesis",
      name: { es: "Génesis", en: "Genesis", pt: "Gênesis" }[locale],
      versesPerChapter: sizes,
    };
    for (const sample of cases) {
      const ranges = Array.from(
        { length: sample.end - sample.start + 1 },
        (_, i) => {
          const chapter = sample.start + i;
          return {
            book,
            chapter,
            first: chapter === sample.start ? sample.first : 1,
            last: chapter === sample.end ? sample.last : sizes[chapter - 1],
          };
        },
      );
      const result = episodeReference(ranges, locale, (n) =>
        numberToWords(locale, n),
      );
      assert.equal(result.spoken, sample.expected[locale]);
      assert.doesNotMatch(result.spoken, /\d/);
      const intro = {
        es: "Bienvenidos a La Biblia en trescientos sesenta y cinco días. Hoy escucharemos {reference}.",
        en: "Welcome to The Bible in three hundred and sixty-five days. Today we will listen to {reference}.",
        pt: "Bem-vindos à Bíblia em trezentos e sessenta e cinco dias. Hoje ouviremos {reference}.",
      }[locale];
      const scripts = await renderVoiceScripts({
        locale,
        templates: { intro, outro: "{reference}." },
        reference: result.spoken,
        start: result.start,
        end: result.end,
        book: book.name,
        version: "Bible",
        passage_id: "test",
      });
      assert.equal(
        scripts.intro,
        intro.replace("{reference}", sample.expected[locale]),
      );
      assert.equal(scripts.outro, `${sample.expected[locale]}.`);
    }
  }
});
