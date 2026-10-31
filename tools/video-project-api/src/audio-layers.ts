import type { AudioLayer, AudioRecording } from "./audio-project-schema.js";

/** All layer boundaries refer to the initial take, so reordering never moves a cut. */
export function audioLayerSegments(recording: AudioRecording) {
  const base = recording.base ?? recording;
  const layers = recording.layers?.filter((layer) => layer.enabled) ?? [];
  const boundaries = [
    ...new Set([
      0,
      base.duration,
      ...layers.flatMap((layer) => [layer.start, layer.end]),
    ]),
  ].sort((a, b) => a - b);
  const segments: {
    file: string;
    trim: { startSeconds: number; endSeconds: number };
    pause: number;
  }[] = [];
  for (let i = 1; i < boundaries.length; i++) {
    const start = boundaries[i - 1],
      end = boundaries[i];
    const layer = layers.findLast(
      (layer) => layer.start <= start && layer.end >= end,
    );
    const source = layer ?? base;
    const offset = layer?.start ?? 0;
    const scale = layer ? layer.duration / (layer.end - layer.start) : 1;
    const trim = {
      startSeconds: (start - offset) * scale,
      endSeconds: (end - offset) * scale,
    };
    const previous = segments.at(-1);
    if (
      previous?.file === source.file &&
      Math.abs(previous.trim.endSeconds - trim.startSeconds) < 0.000001
    )
      previous.trim.endSeconds = trim.endSeconds;
    else segments.push({ file: source.file, trim, pause: 0 });
  }
  return segments;
}

export function orderedAudioLayers(
  layers: AudioLayer[],
  edits: { revision: string; enabled: boolean }[],
) {
  const ids = new Set(edits.map((edit) => edit.revision));
  if (
    ids.size !== edits.length ||
    edits.some(
      (edit) => !layers.some((layer) => layer.revision === edit.revision),
    )
  )
    throw new Error("The verse changed. Reload it before correcting a phrase.");
  return edits.map((edit) => ({
    ...layers.find((layer) => layer.revision === edit.revision)!,
    enabled: edit.enabled,
  }));
}

export function audioLayerText(recording: AudioRecording) {
  const base = recording.base ?? recording;
  const text = base.text ?? "";
  const layers = recording.layers?.filter((layer) => layer.enabled) ?? [];
  const boundaries = [
    ...new Set([
      0,
      text.length,
      ...layers.flatMap((layer) => [layer.textStart, layer.textEnd]),
    ]),
  ].sort((a, b) => a - b);
  return boundaries
    .slice(1)
    .map((end, i) => {
      const start = boundaries[i];
      const layer = layers.findLast(
        (layer) => layer.textStart <= start && layer.textEnd >= end,
      );
      if (!layer) return text.slice(start, end);
      const replacement = layer.text ?? "";
      const scale = replacement.length / (layer.textEnd - layer.textStart);
      return replacement.slice(
        Math.round((start - layer.textStart) * scale),
        Math.round((end - layer.textStart) * scale),
      );
    })
    .join("");
}
