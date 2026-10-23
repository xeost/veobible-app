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
  return Boolean(
    current &&
    approved &&
    current.recordingRevision === approved.recordingRevision &&
    current.trim.startSeconds === approved.trim.startSeconds &&
    current.trim.endSeconds === approved.trim.endSeconds,
  );
}

/** Review metadata does not change the rendered chapter audio. */
export function audioMixSettingsChanged(
  previous: AudioSettings,
  next: AudioSettings,
) {
  const { approvals: _previousApprovals, ...previousMix } = previous;
  const { approvals: _nextApprovals, ...nextMix } = next;
  return JSON.stringify(previousMix) !== JSON.stringify(nextMix);
}
