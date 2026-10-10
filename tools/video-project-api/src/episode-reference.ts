export interface EpisodeChapterRange {
  book: { id: string; name: string; versesPerChapter: number[] };
  chapter: number;
  first: number;
  last: number;
}

/** Group complete chapters while retaining every partial chapter's exact verse range. */
export function episodeReference(
  ranges: EpisodeChapterRange[],
  locale: "en" | "es" | "pt",
  words: (number: number) => string,
  spokenBook: (name: string) => string = (name) => name,
) {
  const groups: {
    book: EpisodeChapterRange["book"];
    ranges: {
      first: number;
      last: number;
      verses?: { first: number; last: number };
    }[];
  }[] = [];
  for (const range of ranges) {
    let group = groups.at(-1);
    if (!group || group.book.id !== range.book.id) {
      group = { book: range.book, ranges: [] };
      groups.push(group);
    }
    const complete =
      range.first === 1 &&
      range.last === range.book.versesPerChapter[range.chapter - 1];
    const previous = group.ranges.at(-1);
    if (
      complete &&
      previous &&
      !previous.verses &&
      previous.last + 1 === range.chapter
    )
      previous.last = range.chapter;
    else
      group.ranges.push({
        first: range.chapter,
        last: range.chapter,
        ...(complete
          ? {}
          : { verses: { first: range.first, last: range.last } }),
      });
  }
  const chapter = { en: "chapter", es: "capítulo", pt: "capítulo" }[locale];
  const verse = { en: "verse", es: "versículo", pt: "versículo" }[locale];
  const endpoint = (
    range: EpisodeChapterRange | undefined,
    edge: "first" | "last",
  ) => {
    if (!range) return "";
    const partial =
      edge === "first"
        ? range.first > 1
        : range.last < range.book.versesPerChapter[range.chapter - 1];
    return `${chapter} ${words(range.chapter)}${partial ? ` ${verse} ${words(range[edge])}` : ""}`;
  };
  return {
    start: endpoint(ranges[0], "first"),
    end: endpoint(ranges.at(-1), "last"),
    display: groups
      .map(
        (group) =>
          `${group.book.name} ${group.ranges.map((range) => `${range.first}${range.last !== range.first ? `–${range.last}` : ""}${range.verses ? `:${range.verses.first}${range.verses.last !== range.verses.first ? `–${range.verses.last}` : ""}` : ""}`).join("; ")}`,
      )
      .join(" · "),
    spoken: (() => {
      const first = ranges[0],
        last = ranges.at(-1);
      if (!first || !last) return "";
      const book = spokenBook(first.book.name);
      const start = endpoint(first, "first"),
        end = endpoint(last, "last");
      const sameBook = first.book.id === last.book.id;
      if (sameBook && first.chapter === last.chapter) {
        if (
          first.first === 1 &&
          last.last === first.book.versesPerChapter[first.chapter - 1]
        )
          return `${book} ${start}`;
        if (first.first === 1) {
          const until = { en: "through", es: "hasta el", pt: "até o" }[locale];
          return `${book} ${start} ${until} ${verse} ${words(last.last)}`;
        }
        if (last.last === last.book.versesPerChapter[last.chapter - 1]) {
          const from = { en: "from", es: "desde el", pt: "a partir do" }[
            locale
          ];
          return `${book} ${chapter} ${words(first.chapter)} ${from} ${verse} ${words(first.first)}`;
        }
        const plural = { en: "verses", es: "versículos", pt: "versículos" }[
          locale
        ];
        const to = { en: "to", es: "al", pt: "a" }[locale];
        return `${book} ${chapter} ${words(first.chapter)} ${first.first === last.last ? verse : plural} ${words(first.first)}${first.first === last.last ? "" : ` ${to} ${words(last.last)}`}`;
      }
      const from = { en: "from", es: "desde el", pt: "do" }[locale];
      const to = sameBook
        ? { en: "to", es: "al", pt: "ao" }[locale]
        : { en: "to", es: "hasta", pt: "até" }[locale];
      return `${book} ${from} ${start} ${to} ${sameBook ? "" : `${spokenBook(last.book.name)} `}${end}`;
    })(),
  };
}
