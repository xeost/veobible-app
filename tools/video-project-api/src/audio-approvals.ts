import type { AudioProject, AudioSettings } from "./audio-project-schema.js";

export function audioVerseApproval(
  project: Pick<AudioProject, "recordings">,
  settings: AudioSettings,
  reference: string,
): NonNullable<AudioSettings["approvals"]>[string] | undefined {
  const recording = project.recordings[reference];
  if (!recording) return undefined;
  return {
    recordingRevision: recording.revision,
    trim: {
      ...(settings.trims[reference] ?? {
        startSeconds: 0,
        endSeconds: recording.duration,
      }),
    },
  };
}

export function isAudioVerseApproved(
  project: Pick<AudioProject, "recordings">,
  settings: AudioSettings,
  reference: string,
) {
  const current = audioVerseApproval(project, settings, reference);
  const approved = settings.approvals?.[reference];
  if (!project.recordings[reference])
    return Boolean(approved?.editingFilesRemoved);
  return Boolean(
    current &&
    approved &&
    current.recordingRevision === approved.recordingRevision &&
    current.trim.startSeconds === approved.trim.startSeconds &&
    current.trim.endSeconds === approved.trim.endSeconds,
  );
}

function sameSettingsValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter((key) => left[key] !== undefined);
  return (
    keys.length ===
      Object.keys(right).filter((key) => right[key] !== undefined).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) && sameSettingsValue(left[key], right[key]),
    )
  );
}

/** Review metadata does not change the rendered chapter audio. */
export function audioMixSettingsChanged(
  previous: AudioSettings,
  next: AudioSettings,
) {
  const {
    approvals: _previousApprovals,
    pronunciation: _previousPronunciation,
    ...previousMix
  } = previous;
  const {
    approvals: _nextApprovals,
    pronunciation: _nextPronunciation,
    ...nextMix
  } = next;
  return !sameSettingsValue(previousMix, nextMix);
}
