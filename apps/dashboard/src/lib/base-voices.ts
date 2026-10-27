import { narrationModelSchema } from "../../../../tools/video-project-api/src/narration-models";
import {
  voiceStyleDefaultsSchema,
  type VoiceStyleDefaults,
} from "./voice-style-presets";
import { z } from "zod";
import { audioVersePauseKey, audioVersePauseSchema } from "./audio-settings";
import {
  readingNarrationOverridesSchema,
  type ReadingNarrationOverrides,
} from "./narration-parameters";
import {
  baseVoiceSchema,
  voiceForLocale,
  voiceRolesSchema,
  inheritedVoiceRoles,
  selectedRoleVoice,
} from "../../../../tools/video-project-api/src/base-voice-schema";
export {
  sampleTexts,
  voiceForLocale,
  voiceRolesSchema,
  inheritedVoiceRoles,
  selectedRoleVoice,
} from "../../../../tools/video-project-api/src/base-voice-schema";
export type { VoiceLocale } from "../../../../tools/video-project-api/src/base-voice-schema";
const languageVoices = (locale: string) =>
  z
    .union([baseVoiceSchema.transform(inheritedVoiceRoles), voiceRolesSchema])
    .refine((roles) =>
      Object.values(roles).every((id) => id.startsWith(`${locale}-`)),
    );
export const baseVoiceDefaultsSchema = z
  .object({
    es: languageVoices("es"),
    en: languageVoices("en"),
    pt: languageVoices("pt"),
  })
  .strict();
export type BaseVoiceDefaults = z.infer<typeof baseVoiceDefaultsSchema>;
export const defaultBaseVoices = (): BaseVoiceDefaults => ({
  es: inheritedVoiceRoles("es-1"),
  en: inheritedVoiceRoles("en-1"),
  pt: inheritedVoiceRoles("pt-1"),
});
export function resolveAudioBaseVoice<
  T extends { baseVoice: string; inheritBaseVoice?: boolean },
>(settings: T, locale: "en" | "es" | "pt", defaults: BaseVoiceDefaults) {
  return {
    ...settings,
    baseVoice: voiceForLocale(
      locale,
      settings.inheritBaseVoice ? defaults[locale].reading : settings.baseVoice,
    ),
  };
}
export {
  voiceRoles,
  roleLabels,
} from "../../../../tools/video-project-api/src/base-voice-schema";
export const baseVoiceCatalogSchema = z.object({
  voices: z.array(
    z.object({
      id: baseVoiceSchema,
      locale: z.enum(["es", "en", "pt"]),
      available: z.boolean(),
      generatedAt: z.string().nullable(),
      text: z.string().nullable(),
      status: z.enum(["queued", "running", "done", "failed"]),
      progress: z.number(),
      samples: z
        .array(
          z.object({
            voiceModel: narrationModelSchema,
            available: z.boolean(),
            generatedAt: z.string().nullable(),
            text: z.string().nullable(),
            status: z.enum(["queued", "running", "done", "failed"]),
            progress: z.number(),
            preview: z
              .object({
                id: z.string().uuid(),
                text: z.string(),
                generatedAt: z.string(),
                available: z.literal(true),
              })
              .nullable()
              .optional(),
          }),
        )
        .default([]),
    }),
  ),
});
export type BaseVoice = z.infer<
  typeof baseVoiceCatalogSchema
>["voices"][number];
export async function loadBaseVoiceDefaults(
  database: D1Database,
  kind: "short" | "long" | "book" | "audio",
) {
  const row = await database
    .prepare("SELECT value FROM site_settings WHERE key=?")
    .bind(`base_voice_defaults:${kind}`)
    .first<{ value: string }>();
  return row
    ? baseVoiceDefaultsSchema.parse(JSON.parse(row.value))
    : defaultBaseVoices();
}
export async function saveBaseVoiceDefaults(
  database: D1Database,
  kind: "short" | "long" | "book" | "audio",
  input: unknown,
  readingParameters?: ReadingNarrationOverrides,
  versePauseSeconds?: number,
  stylePresets?: VoiceStyleDefaults,
) {
  const defaults = baseVoiceDefaultsSchema.parse(input);
  const presets =
    stylePresets === undefined
      ? undefined
      : voiceStyleDefaultsSchema.parse(stylePresets);
  const statement = database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `base_voice_defaults:${kind}`,
      JSON.stringify(defaults),
      new Date().toISOString(),
    );
  const statements = [statement];
  if (readingParameters !== undefined)
    statements.push(
      database
        .prepare(
          "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        )
        .bind(
          `reading_voice_parameters:${kind}`,
          JSON.stringify(
            readingNarrationOverridesSchema.parse(readingParameters),
          ),
          new Date().toISOString(),
        ),
    );
  if (presets !== undefined)
    statements.push(
      database
        .prepare(
          "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        )
        .bind(
          `voice_style_defaults:${kind}`,
          JSON.stringify(presets),
          new Date().toISOString(),
        ),
    );
  if (versePauseSeconds !== undefined) {
    if (kind !== "audio")
      throw new Error("Verse pause is only available for audio projects");
    statements.push(
      database
        .prepare(
          "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
        )
        .bind(
          audioVersePauseKey,
          JSON.stringify(audioVersePauseSchema.parse(versePauseSeconds)),
          new Date().toISOString(),
        ),
    );
  }
  if (statements.length === 1) await statement.run();
  else await database.batch(statements);
  return defaults;
}
/** Explicit selections remain fixed; inherited roles resolve against current format defaults. */
export const projectBaseVoice = (
  settings: Parameters<typeof selectedRoleVoice>[0] & {
    inheritedBaseVoiceRoles?: ("intro" | "reading" | "outro")[];
  },
  locale: "es" | "en" | "pt",
  role: "intro" | "outro" | "reading" = "intro",
  defaults?: BaseVoiceDefaults["es"],
) =>
  settings.inheritedBaseVoiceRoles?.includes(role) && defaults
    ? voiceForLocale(locale, defaults[role])
    : selectedRoleVoice(settings, locale, role);

export function resolveProjectBaseVoices<
  T extends Parameters<typeof projectBaseVoice>[0],
>(settings: T, locale: "es" | "en" | "pt", defaults: BaseVoiceDefaults["es"]) {
  const baseVoices = {
    intro: projectBaseVoice(settings, locale, "intro", defaults),
    reading: projectBaseVoice(settings, locale, "reading", defaults),
    outro: projectBaseVoice(settings, locale, "outro", defaults),
  };
  return { ...settings, baseVoice: baseVoices.intro, baseVoices };
}
