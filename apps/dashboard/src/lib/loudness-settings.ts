import {
  defaultLoudnessSettings,
  loudnessSettingsSchema,
} from "../../../../tools/video-project-api/src/loudness-schema";
export { defaultLoudnessSettings, loudnessSettingsSchema };
export type { LoudnessSettings } from "../../../../tools/video-project-api/src/loudness-schema";
const key = "video_loudness";
export async function loadLoudnessSettings(database: D1Database) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(key)
    .first<{ value: string }>();
  return row
    ? loudnessSettingsSchema.parse(JSON.parse(row.value))
    : defaultLoudnessSettings();
}
export async function saveLoudnessSettings(
  database: D1Database,
  input: unknown,
) {
  const settings = loudnessSettingsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(key, JSON.stringify(settings), new Date().toISOString())
    .run();
  return settings;
}
