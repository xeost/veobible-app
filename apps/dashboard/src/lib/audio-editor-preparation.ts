import type { AudioProjectDetail } from "../../../../tools/video-project-api/src/audio-project-schema";
import type { AudioVerseSelection } from "./audio-verse-fragment";

export function audioWaveformResourceKey(
  project: Pick<AudioProjectDetail, "edition" | "book">,
  reference: string,
  revision: string,
) {
  return `${project.edition}/${project.book}/${reference}/${revision}`;
}

/** Only previews mounted by the editor participate; unrecorded verses need no audio. */
export function audioEditorPreparation(
  project: Pick<
    AudioProjectDetail,
    "edition" | "book" | "content" | "recordings"
  > | null,
  expanded: ReadonlySet<number>,
  selected: AudioVerseSelection | null,
  prepared: Readonly<Record<string, boolean>>,
) {
  const keys = (project?.content ?? []).flatMap((chapter) => {
    if (!expanded.has(chapter.chapter)) return [];
    const verse =
      selected?.chapter === chapter.chapter
        ? (chapter.verses.find((verse) => verse.verse === selected.verse) ??
          chapter.verses[0])
        : chapter.verses[0];
    if (!verse || !project) return [];
    const reference = `${chapter.chapter}:${verse.verse}`;
    const recording = project.recordings[reference];
    return recording
      ? [audioWaveformResourceKey(project, reference, recording.revision)]
      : [];
  });
  return {
    total: keys.length,
    completed: keys.filter((key) => key in prepared).length,
    failed: keys.some((key) => prepared[key] === false),
  };
}
