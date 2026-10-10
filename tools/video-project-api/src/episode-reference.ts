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
  const chapters = { en: "chapters", es: "capítulos", pt: "capítulos" }[locale];
  const verse = { en: "verse", es: "versículo", pt: "versículo" }[locale];
  const verses = { en: "verses", es: "versículos", pt: "versículos" }[locale];
  const to = { en: "to", es: "al", pt: "a" }[locale];
  const endpoint = (
    range: EpisodeChapterRange | undefined,
    edge: "first" | "last",
  ) => {
    if (!range) return "";
    const complete =
      range.first === 1 &&
      range.last === range.book.versesPerChapter[range.chapter - 1];
    return `${chapter} ${words(range.chapter)}${complete ? "" : `, ${verse} ${words(range[edge])}`}`;
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
    spoken: groups
      .map((group, index) => {
        const last = group.ranges.at(-1);
        const previous = group.ranges.at(-2);
        const compactEnd =
          index === groups.length - 1 &&
          last?.verses?.first === 1 &&
          previous &&
          !previous.verses &&
          previous.last + 1 === last.first;
        const spokenRanges = (
          compactEnd ? group.ranges.slice(0, -2) : group.ranges
        ).map(
          (range) =>
            `${range.first === range.last ? chapter : chapters} ${words(range.first)}${range.first === range.last ? "" : ` ${to} ${words(range.last)}`}${range.verses ? `, ${range.verses.first === range.verses.last ? verse : verses} ${words(range.verses.first)}${range.verses.first === range.verses.last ? "" : ` ${to} ${words(range.verses.last)}`}` : ""}`,
        );
        // State the final partial chapter as the endpoint of the contiguous chapter range.
        if (compactEnd)
          spokenRanges.push(
            `${chapters} ${words(previous.first)} ${to} ${words(last.last)}, ${verse} ${words(last.verses!.last)}`,
          );
        return `${spokenBook(group.book.name)}, ${spokenRanges.join("; ")}`;
      })
      .join("; "),
  };
}
