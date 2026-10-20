import { z } from "zod";
import { narrationModelsSchema } from "./narration-models";
import {
  narrationStylesSchema,
  defaultNarrationStyles,
  readingNarrationOverridesSchema,
  defaultReadingNarrationOverrides,
} from "../../../../tools/video-project-api/src/narration-parameters";
export * from "../../../../tools/video-project-api/src/narration-parameters";
export async function loadReadingNarrationOverrides(
  database: D1Database,
  kind: "short" | "long" | "book",
) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`reading_voice_parameters:${kind}`)
    .first<{ value: string }>();
  return row
    ? readingNarrationOverridesSchema.parse(JSON.parse(row.value))
    : defaultReadingNarrationOverrides();
}
export async function loadNarrationStyles(database: D1Database) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind("voice_generation_parameters")
    .first<{ value: string }>();
  return row
    ? narrationStylesSchema.parse(JSON.parse(row.value))
    : defaultNarrationStyles();
}

export async function saveNarrationGenerationSettings(
  database: D1Database,
  input: unknown,
) {
  const settings = z
    .object({ models: narrationModelsSchema, styles: narrationStylesSchema })
    .strict()
    .parse(input);
  const now = new Date().toISOString();
  await database.batch(
    [
      ["voice_generation_models", settings.models],
      ["voice_generation_parameters", settings.styles],
    ].map(([key, value]) =>
      database
        .prepare(
          "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        )
        .bind(key, JSON.stringify(value), now),
    ),
  );
  return settings;
}
