export type VideoVerseTarget = { reference: string; section: number };

export function videoVerseFragment(
  target: VideoVerseTarget,
  targets: readonly VideoVerseTarget[],
) {
  const match = /(\d+):(\d+)$/.exec(target.reference);
  if (!match) return null;
  const suffix = `${match[1]}-${match[2]}`;
  const ambiguous = targets.some(
    (other) =>
      other.section !== target.section &&
      other.reference.endsWith(` ${match[1]}:${match[2]}`),
  );
  return ambiguous ? `#reading-${target.section + 1}-${suffix}` : `#${suffix}`;
}

export function parseVideoVerseFragment(
  fragment: string,
  targets: readonly VideoVerseTarget[],
) {
  return (
    targets.find(
      (target) => videoVerseFragment(target, targets) === fragment,
    ) ?? null
  );
}
