import { z } from "zod";
import {
  baseVoiceSchema,
  voiceForLocale,
} from "../../../../tools/video-project-api/src/base-voice-schema";
export {
  sampleTexts,
  voiceForLocale,
} from "../../../../tools/video-project-api/src/base-voice-schema";
export type { VoiceLocale } from "../../../../tools/video-project-api/src/base-voice-schema";
export const baseVoiceDefaultsSchema = z
  .object({
    es: baseVoiceSchema.refine((id) => id.startsWith("es-")),
    en: baseVoiceSchema.refine((id) => id.startsWith("en-")),
    pt: baseVoiceSchema.refine((id) => id.startsWith("pt-")),
  })
  .strict();
export type BaseVoiceDefaults = z.infer<typeof baseVoiceDefaultsSchema>;
export const defaultBaseVoices = (): BaseVoiceDefaults => ({
  es: "es-1",
  en: "en-1",
  pt: "pt-1",
});
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
  kind: "short" | "long",
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
  kind: "short" | "long",
  input: unknown,
) {
  const defaults = baseVoiceDefaultsSchema.parse(input);
  await database
    .prepare(
      "INSERT INTO site_settings(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",
    )
    .bind(
      `base_voice_defaults:${kind}`,
      JSON.stringify(defaults),
      new Date().toISOString(),
    )
    .run();
  return defaults;
}
/** Legacy projects used voice 1. Never resolve their voice from mutable defaults. */
export const projectBaseVoice = (
  settings: { baseVoice?: string },
  locale: "es" | "en" | "pt",
) => voiceForLocale(locale, settings.baseVoice);
