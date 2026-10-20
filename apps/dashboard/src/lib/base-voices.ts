import { z } from "zod";
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
    }),
  ),
});
export type BaseVoice = z.infer<
  typeof baseVoiceCatalogSchema
>["voices"][number];
export async function loadBaseVoiceDefaults(
  database: D1Database,
  kind: "short" | "long" | "book",
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
  kind: "short" | "long" | "book",
  input: unknown,
  readingParameters?: ReadingNarrationOverrides,
) {
  const defaults = baseVoiceDefaultsSchema.parse(input);
  const statement = database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `base_voice_defaults:${kind}`,
      JSON.stringify(defaults),
      new Date().toISOString(),
    );
  if (readingParameters === undefined) await statement.run();
  else
    await database.batch([
      statement,
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
    ]);
  return defaults;
}
/** Legacy projects used voice 1. Never resolve their voice from mutable defaults. */
export const projectBaseVoice = (
  settings: Parameters<typeof selectedRoleVoice>[0],
  locale: "es" | "en" | "pt",
  role: "intro" | "outro" | "reading" = "intro",
) => selectedRoleVoice(settings, locale, role);
