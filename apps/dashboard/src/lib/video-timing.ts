import type { ChapterIntroduction } from "../../../../tools/video-project-api/src/chapter-introductions";
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
  manuallyAdjusted?: boolean;
}
export interface ReadingSection {
  sourceDuration?: number;
  start: number;
  end: number;
}

/** Preserve the source-file coordinates used by waveform playback. */
export function waveformReadingSources(sections: ReadingSection[]) {
  return sections.map((section, index) => ({
    ...section,
    file: `reading-${index}`,
  }));
}
export interface Inspection {
  label: string;
  sections: ReadingSection[];
  cues: VerseCue[];
  chapterIntroductions?: ChapterIntroduction[];
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
    startMin: sectionStart,
    startMax: cue.end - 0.02,
    endMin: cue.start + 0.02,
    endMax: sectionEnd,
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
    (cue) =>
      Number.isFinite(cue.start) &&
      Number.isFinite(cue.end) &&
      cue.start >= 0 &&
      cue.end <= maxDuration + 1e-6 &&
      cue.end > cue.start,
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

/** Existing saved offsets are treated as manual unless explicitly recorded as automatic. */
export function verseHasManualCuts(offsets: VerseOffset[], reference: string) {
  const offset = offsets.find((entry) => entry.reference === reference);
  return Boolean(offset && offset.manuallyAdjusted !== false);
}

/** Align only the selected verse, preserving its length and respecting the original audio end. */
export function alignSelectedVerse(
  cues: VerseCue[],
  index: number,
  sourceEnd: number,
  manuallyAdjusted = false,
) {
  const cue = cues[index];
  if (!cue) throw new Error("Missing selected verse");
  if (
    index === 0 ||
    manuallyAdjusted ||
    Math.abs(cue.start - cues[index - 1].end) < 1e-6
  )
    return { cue, moved: false, blocked: false };
  const start = cues[index - 1].end;
  const duration = cue.end - cue.start;
  const end = start + duration;
  if (end > sourceEnd + 1e-6) return { cue, moved: false, blocked: true };
  return { cue: { ...cue, start, end }, moved: true, blocked: false };
}
