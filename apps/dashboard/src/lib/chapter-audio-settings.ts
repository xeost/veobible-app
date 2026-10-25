import { z } from "zod";
import { audioEditionSchema } from "../../../../tools/video-project-api/src/audio-project-schema";

const versions = z.record(
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  z.union([z.literal(""), audioEditionSchema]),
);
export const chapterAudioSettingsSchema = z.object({
  es: versions,
  en: versions,
  pt: versions,
});
export type ChapterAudioSettings = z.infer<typeof chapterAudioSettingsSchema>;
export const emptyChapterAudioSettings = (): ChapterAudioSettings => ({
  es: {},
  en: {},
  pt: {},
});
export async function loadChapterAudioSettings(
  database: D1Database,
  kind: "short" | "long" | "book",
) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`chapter_audio:${kind}`)
    .first<{ value: string }>();
  return row
    ? chapterAudioSettingsSchema.parse(JSON.parse(row.value))
    : emptyChapterAudioSettings();
}
export async function saveChapterAudioSettings(
  database: D1Database,
  kind: "short" | "long" | "book",
  input: unknown,
) {
  const settings = chapterAudioSettingsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `chapter_audio:${kind}`,
      JSON.stringify(settings),
      new Date().toISOString(),
    )
    .run();
  return settings;
}
export function inheritsChapterAudio(settings: {
  audioEdition?: string;
  inheritAudioEdition?: boolean;
}) {
  return settings.inheritAudioEdition ?? !settings.audioEdition;
}
export function resolveChapterAudio<
  T extends { audioEdition?: string; inheritAudioEdition?: boolean },
>(settings: T, defaultEdition?: string): T {
  const inheritAudioEdition = inheritsChapterAudio(settings);
  return {
    ...settings,
    inheritAudioEdition,
    audioEdition: inheritAudioEdition
      ? defaultEdition || undefined
      : settings.audioEdition,
  };
}
