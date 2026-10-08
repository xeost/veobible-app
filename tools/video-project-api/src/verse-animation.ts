/** Shared by audio scheduling and both browser/render text animations. */
export function verseAnimationSpans(duration: number, lines: number) {
  const scale = Math.min(1, duration / 2.5);
  return {
    entrance: (0.62 + (lines - 1) * 0.055) * scale,
    exit: (0.32 + (lines - 1) * 0.015) * scale,
  };
}

export function verseTextPhases(
  cues: readonly { start: number; end: number }[],
  lineCounts: readonly number[],
  index: number,
  readingSilence: number,
) {
  const cue = cues[index];
  const count = lineCounts[index];
  const spans = verseAnimationSpans(cue.end - cue.start, count);
  const enterScale = Math.min(spans.entrance, readingSilence + cue.start) / (0.62 + (count - 1) * 0.055);
  const exitScale = spans.exit / (0.32 + (count - 1) * 0.015);
  const delays = [0, 0.09, ...Array.from({ length: count }, (_, row) => 0.16 + row * 0.055)];
  return delays.map((delay, row) => ({
    // All lines finish entering before this verse's first spoken word.
    start: readingSilence + cue.start - (0.62 + (count - 1) * 0.055) * enterScale + delay * enterScale,
    duration: 0.46 * enterScale,
    // The verse remains fully visible through the last spoken word.
    exit: readingSilence + cue.end + Math.max(0, row - 2) * 0.015 * exitScale,
    exitDuration: 0.32 * exitScale,
  }));
}
