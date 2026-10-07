import { z } from "zod";
const versions = z.record(
  z.string().regex(/^[a-z0-9-]+$/),
  z.object({ volumeMultiplier: z.number().finite().min(0).max(4) }),
);
export const projectSettingsSchema = z.object({
  es: versions,
  en: versions,
  pt: versions,
});
export type ProjectSettings = z.infer<typeof projectSettingsSchema>;
export const emptyProjectSettings = (): ProjectSettings => ({
  es: {},
  en: {},
  pt: {},
});
export async function loadProjectSettings(
  database: D1Database,
  kind: "short" | "long",
): Promise<ProjectSettings> {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`project_settings:${kind}`)
    .first<{ value: string }>();
  return row
    ? projectSettingsSchema.parse(JSON.parse(row.value))
    : emptyProjectSettings();
}
export async function saveProjectSettings(
  database: D1Database,
  kind: "short" | "long",
  input: unknown,
) {
  const settings = projectSettingsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `project_settings:${kind}`,
      JSON.stringify(settings),
      new Date().toISOString(),
    )
    .run();
  return settings;
}
export function versionProjectSettings(
  settings: ProjectSettings,
  locale: string,
  version: string,
) {
  return (
    settings[locale as keyof ProjectSettings]?.[version] ?? {
      volumeMultiplier: 1,
    }
  );
}
