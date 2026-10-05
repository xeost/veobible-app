import type { VerseCue, VerseOffset } from "./verse-timing.js";

export function moveVerseBoundary(cues: VerseCue[], index: number, edge: "start" | "end", time: number, duration: number): VerseCue[] {
  if (!cues[index] || !Number.isFinite(time)) throw new Error("Invalid verse boundary");
  const adjusted = cues.map(cue => ({ ...cue }));
  adjusted[index][edge] = time;
  if (edge === "start" && index > 0) adjusted[index - 1].end = time;
  if (edge === "end" && index < adjusted.length - 1) adjusted[index + 1].start = time;
  for (let i = 0; i < adjusted.length; i++) {
    const cue = adjusted[i];
    if (cue.start < 0 || cue.end > duration + 1e-6 || cue.end <= cue.start || i > 0 && cue.start < adjusted[i - 1].end - 1e-6) {
      throw new Error("Keep every verse within the reading, with positive duration and no overlap");
    }
  }
  return adjusted;
}

export function offsetsFromCues(estimates: VerseCue[], cues: VerseCue[]): VerseOffset[] {
  return estimates.map((estimate, index) => {
    const cue = cues[index];
    if (!cue || cue.reference !== estimate.reference) throw new Error("Verse references do not match the estimates");
    const rounded = (value: number) => Number(value.toFixed(6));
    return { reference: cue.reference, startOffsetSeconds: rounded(cue.start - estimate.start), endOffsetSeconds: rounded(cue.end - estimate.end) };
  });
}
