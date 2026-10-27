export type AudioVerseSelection = { chapter: number; verse: number };

export function audioVerseFragment({ chapter, verse }: AudioVerseSelection) {
  return `#${chapter}-${verse}`;
}

export function parseAudioVerseFragment(
  fragment: string,
  verseCounts: readonly number[],
): AudioVerseSelection | null {
  const match = /^#(?:verse-)?([1-9]\d*)-([1-9]\d*)$/.exec(fragment);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  if (
    !Number.isSafeInteger(chapter) ||
    !Number.isSafeInteger(verse) ||
    chapter > verseCounts.length ||
    verse > verseCounts[chapter - 1]
  )
    return null;
  return { chapter, verse };
}
