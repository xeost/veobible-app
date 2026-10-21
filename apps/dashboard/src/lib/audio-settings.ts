import { z } from "zod";
import type { AudioSettings } from "../../../../tools/video-project-api/src/audio-project-schema";

export const defaultAudioVersePause = 0.35;
export const audioVersePauseSchema = z.number().finite().min(0).max(10);
export const audioVersePauseKey = "audio_verse_pause_seconds";

export async function loadAudioVersePause(database: D1Database) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(audioVersePauseKey)
    .first<{ value: string }>();
  return row
    ? audioVersePauseSchema.parse(JSON.parse(row.value))
    : defaultAudioVersePause;
}

/** Resolve the global setting into the existing generator's per-verse contract. */
export function withAudioVersePause(
  settings: AudioSettings,
  verseCounts: number[],
  pauseSeconds: number,
): AudioSettings {
  const pause = audioVersePauseSchema.parse(pauseSeconds);
  return {
    ...settings,
    pauses: Object.fromEntries(
      verseCounts.flatMap((count, chapter) =>
        Array.from({ length: count }, (_, verse) => [
          `${chapter + 1}:${verse + 1}`,
          pause,
        ]),
      ),
    ),
  };
}
