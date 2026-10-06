export interface VerseCue {
  reference: string;
  text: string;
  start: number;
  end: number;
}
export interface VerseOffset {
  reference: string;
  startOffsetSeconds: number;
  endOffsetSeconds: number;
}
export interface ReadingSection {
  start: number;
  end: number;
}
export interface Inspection {
  label: string;
  sections: ReadingSection[];
  cues: VerseCue[];
  scripts: { intro: string; outro: string };
}
export function adjustedCues(
  cues: VerseCue[],
  offsets: VerseOffset[],
): VerseCue[] {
  return cues.map((cue) => {
    const offset = offsets.find((entry) => entry.reference === cue.reference);
    return {
      ...cue,
      start: cue.start + (offset?.startOffsetSeconds ?? 0),
      end: cue.end + (offset?.endOffsetSeconds ?? 0),
    };
  });
}
export function readingTimeline(sections: ReadingSection[]) {
  let elapsed = 0;
  return sections.map((section, index) => {
    const start = elapsed;
    elapsed += section.end - section.start;
    return { ...section, index, timelineStart: start, timelineEnd: elapsed };
  });
}
export function trimBounds(
  cues: VerseCue[],
  index: number,
  sectionStart: number,
  sectionEnd: number,
) {
  const cue = cues[index];
  return {
    startMin: Math.max(sectionStart, cues[index - 1]?.end ?? sectionStart),
    startMax: cue.end - 0.02,
    endMin: cue.start + 0.02,
    endMax: Math.min(sectionEnd, cues[index + 1]?.start ?? sectionEnd),
  };
}
export function trimCue(
  cues: VerseCue[],
  index: number,
  edge: "start" | "end",
  time: number,
  sectionStart: number,
  sectionEnd: number,
): number {
  const bounds = trimBounds(cues, index, sectionStart, sectionEnd);
  return Math.max(
    bounds[`${edge}Min`],
    Math.min(bounds[`${edge}Max`], Math.round(time * 1000) / 1000),
  );
}

export function validVerseTimings(
  cues: VerseCue[],
  maxDuration: number,
): boolean {
  return cues.every(
    (cue, index) =>
      Number.isFinite(cue.start) &&
      Number.isFinite(cue.end) &&
      cue.start >= 0 &&
      cue.end <= maxDuration + 1e-6 &&
      cue.end > cue.start &&
      (index === 0 || cue.start >= cues[index - 1].end - 1e-6),
  );
}

/** Visible context stays inside the available reading section. */
export function waveformWindow(
  cue: Pick<VerseCue, "start" | "end">,
  sectionStart: number,
  sectionEnd: number,
  margin = 5,
) {
  return {
    start: Math.max(sectionStart, cue.start - margin),
    end: Math.min(sectionEnd, cue.end + margin),
  };
}

export function trimPreviewRange(
  cue: Pick<VerseCue, "start" | "end">,
  edge: "start" | "end",
) {
  return edge === "start"
    ? { start: cue.start, end: Math.min(cue.end, cue.start + 3) }
    : { start: Math.max(cue.start, cue.end - 3), end: cue.end };
}

export function waveformSeekRange(
  cue: Pick<VerseCue, "start" | "end">,
  time: number,
) {
  return time >= cue.start && time < cue.end
    ? { start: time, end: cue.end }
    : null;
}
