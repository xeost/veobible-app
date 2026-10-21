import {
  voiceStyleDefaultsSchema,
  emptyVoiceStyleDefaults,
} from "../../../../tools/video-project-api/src/narration-preset-selection";
import {
  loadReadingNarrationOverrides,
  resolveReadingNarrationParameters,
  narrationPresets,
} from "./narration-parameters";
export * from "../../../../tools/video-project-api/src/narration-preset-selection";

export async function loadVoiceStyleDefaults(
  database: D1Database,
  kind: "short" | "long" | "book" | "audio",
) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`voice_style_defaults:${kind}`)
    .first<{ value: string }>();
  if (row) return voiceStyleDefaultsSchema.parse(JSON.parse(row.value));
  // Existing separate reading values remain available as a saved style.
  const legacy = await loadReadingNarrationOverrides(database, kind);
  const defaults = emptyVoiceStyleDefaults();
  for (const locale of ["en", "es", "pt"] as const) {
    if (legacy[locale])
      defaults[locale].reading = {
        id: "saved-reading",
        name: "Saved narration",
        settings: resolveReadingNarrationParameters(
          narrationPresets.natural,
          legacy[locale],
        ),
      };
  }
  return defaults;
}
