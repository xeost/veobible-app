import type {
  AudioProject,
  AudioProjectDetail,
} from "../../../../tools/video-project-api/src/audio-project-schema";
import type { AudioMediaAccess } from "./audio-media";
import type { BaseVoiceDefaults } from "./base-voices";
import type { VoiceStylePresets } from "./voice-style-presets";

export type AudioEditorExtras = {
  mediaAccess: AudioMediaAccess;
  baseVoiceDefaults: BaseVoiceDefaults["en"];
  voiceStyleDefaults: VoiceStylePresets;
};
type Read = <T>(path: string, init: { signal?: AbortSignal }) => Promise<T>;

/** Static Bible text is fetched once; unchanged polls never replace editor state. */
export async function refreshAudioEditor(
  read: Read,
  endpoint: string,
  current: AudioProjectDetail | null,
  signal?: AbortSignal,
) {
  const [state, content] = await Promise.all([
    read<{
      unchanged?: boolean;
      project?: AudioProject;
      extras?: Partial<AudioEditorExtras>;
    }>(`${endpoint}/state${current ? `?revision=${current.revision}` : ""}`, {
      signal,
    }),
    current
      ? Promise.resolve({
          content: current.content,
          originalChapters: current.originalChapters,
        })
      : read<Pick<AudioProjectDetail, "content" | "originalChapters">>(
          `${endpoint}/content`,
          { signal },
        ),
  ]);
  return {
    project: state.project ? { ...state.project, ...content } : null,
    extras: state.extras,
  };
}
