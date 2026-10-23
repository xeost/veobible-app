export type AudioVerseSelection = { chapter: number; verse: number };

export function audioVerseStorageKey(edition: string, book: string) {
  return `veo-audio-verse:${encodeURIComponent(edition)}:${encodeURIComponent(book)}`;
}

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

export function restoreAudioVerseSelection(
  edition: string,
  book: string,
  fragment: string,
  verseCounts: readonly number[],
  storage?: Pick<Storage, "getItem">,
): AudioVerseSelection | null {
  const linked = parseAudioVerseFragment(fragment, verseCounts);
  if (linked) return linked;
  try {
    const remembered = (storage ?? localStorage).getItem(
      audioVerseStorageKey(edition, book),
    );
    return parseAudioVerseFragment(remembered ?? "", verseCounts);
  } catch {
    return null;
  }
}

export function rememberAudioVerseSelection(
  edition: string,
  book: string,
  selection: AudioVerseSelection,
  storage?: Pick<Storage, "setItem">,
) {
  try {
    (storage ?? localStorage).setItem(
      audioVerseStorageKey(edition, book),
      audioVerseFragment(selection),
    );
  } catch {
    // Navigation still works when browser storage is blocked or full.
  }
}
