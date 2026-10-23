import {
  narrationModelsSchema,
  defaultNarrationModels,
} from "../../../../tools/video-project-api/src/narration-models";
export {
  narrationModelsSchema,
  defaultNarrationModels,
  narrationModelOptions,
  selectedNarrationDecoder,
  selectedNarrationTextAdaptations,
  type NarrationModels,
} from "../../../../tools/video-project-api/src/narration-models";
const key = "voice_generation_models";
export async function loadNarrationModels(database: D1Database) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(key)
    .first<{ value: string }>();
  return row
    ? narrationModelsSchema.parse(JSON.parse(row.value))
    : defaultNarrationModels();
}
export async function saveNarrationModels(
  database: D1Database,
  input: unknown,
) {
  const models = narrationModelsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(key, JSON.stringify(models), new Date().toISOString())
    .run();
  return models;
}

/** Model uses reflect the saved dashboard choice, independent of local fallback env vars. */
export function applyNarrationSelection<
  T extends import("./local-models").LocalModels,
>(inventory: T, selection: import("./narration-models").NarrationModels): T {
  const variants = {
    chatterbox: "chatterbox-original",
    "multilingual-v3": "chatterbox-v3",
    latam: "chatterbox-latam",
    "pt-br": "chatterbox-pt-br",
  };
  return {
    ...inventory,
    models: inventory.models.map((model) => {
      if (model.role !== "voice") return model;
      const languages = (["en", "es", "pt"] as const).filter(
        (locale) => variants[selection[locale]] === model.variant,
      );
      return {
        ...model,
        uses: languages.length
          ? (["short", "long"] as const).map((kind) => ({ kind, languages }))
          : [],
      };
    }),
  };
}
