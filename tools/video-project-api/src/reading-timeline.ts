interface AudioSection {
  file: string;
  start: number;
  end: number;
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
