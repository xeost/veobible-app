import { verseAnimationSpans } from "./verse-animation";

interface AudioSection {
  file: string;
  start: number;
  end: number;
}

/** Convert independently trimmed source verses to a timeline with silent text transitions. */
export function buildVerseReading<T extends { start: number; end: number }>(
  sections: AudioSection[],
  cues: T[],
  lineCounts: number[],
) {
  let total = 0;
  const sources = sections.map((section) => {
    const source = { ...section, offset: total };
    total += section.end - section.start;
    return source;
  });
  const scheduled: Array<AudioSection & { timelineStart: number }> = [];
  let elapsed = 0;
  const mapped = cues.map((cue, index) => {
    if (
      !Number.isFinite(cue.start) || !Number.isFinite(cue.end) ||
      cue.start < 0 || cue.end <= cue.start ||
      cue.end > total + 1e-6 || !lineCounts[index]
    )
      throw new Error("The reading needs valid verse cuts and text layouts");
    if (index > 0) {
      const previous = cues[index - 1];
      elapsed += verseAnimationSpans(
        previous.end - previous.start, lineCounts[index - 1],
      ).exit + verseAnimationSpans(cue.end - cue.start, lineCounts[index]).entrance;
    }
    const start = elapsed;
    for (const source of sources) {
      const from = Math.max(cue.start, source.offset);
      const to = Math.min(cue.end, source.offset + source.end - source.start);
      if (to <= from) continue;
      scheduled.push({
        file: source.file,
        start: source.start + from - source.offset,
        end: source.start + to - source.offset,
        timelineStart: elapsed,
      });
      elapsed += to - from;
    }
    return { ...cue, start, end: elapsed };
  });
  return { sections: scheduled, cues: mapped, duration: elapsed };
}

/** End playback at the final verse boundary, preserving source offsets and internal pauses. */
export function trimReadingTail(
  sections: AudioSection[],
  cues: Array<{ end: number }>,
): { sections: AudioSection[]; duration: number } {
  const sourceDuration = sections.reduce(
    (sum, section) => sum + section.end - section.start,
    0,
  );
  const duration = Math.min(
    sourceDuration,
    Math.max(...cues.map((cue) => cue.end)),
  );
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("The reading needs a valid final verse boundary");

  let remaining = duration;
  const trimmed: AudioSection[] = [];
  for (const section of sections) {
    if (remaining <= 0) break;
    const length = Math.min(remaining, section.end - section.start);
    trimmed.push({ ...section, end: section.start + length });
    remaining -= length;
  }
  return { sections: trimmed, duration };
}

/** Preserve the editor's exact cuts without replacing authoritative passage text. */
export function applyReadingCuts<T extends { reference: string; start: number; end: number }>(
  cues: T[],
  cuts: Array<{ reference: string; start: number; end: number }> | undefined,
  duration: number,
): T[] {
  if (!cuts) return cues;
  const byReference = new Map(cuts.map((cut) => [cut.reference, cut]));
  if (cuts.length !== cues.length || byReference.size !== cues.length ||
      cues.some((cue) => !byReference.has(cue.reference)))
    throw new Error("Reading cuts must match every verse in the passage");
  return cues.map((cue) => {
    const cut = byReference.get(cue.reference)!;
    if (!Number.isFinite(cut.start) || !Number.isFinite(cut.end) ||
        cut.start < 0 || cut.end <= cut.start || cut.end > duration + 1e-6)
      throw new Error("Reading cuts must stay within the source audio");
    return { ...cue, start: cut.start, end: cut.end };
  });
}
