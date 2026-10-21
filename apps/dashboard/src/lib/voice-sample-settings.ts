import { z } from "zod";
import {
  narrationModelsSchema,
  selectedNarrationDecoder,
} from "./narration-models";
import {
  narrationStylesSchema,
  readingNarrationParametersSchema,
  resolveNarrationStyle,
  resolveReadingNarrationParameters,
  type ReadingNarrationParameters,
} from "./narration-parameters";
import type { VoiceLocale } from "./base-voices";

export const voiceSampleSettingsSchema = z
  .object({
    models: narrationModelsSchema,
    styles: narrationStylesSchema,
  })
  .strict();
export type VoiceSampleSettings = z.infer<typeof voiceSampleSettingsSchema>;
export const voiceSampleRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    kind: z.enum(["short", "long", "book", "audio"]).optional(),
    role: z.enum(["intro", "outro", "reading"]).optional(),
    readingParameters: readingNarrationParametersSchema.nullable().optional(),
    narrationSettings: voiceSampleSettingsSchema.optional(),
  })
  .strict()
  .refine((value) => value.role !== "reading" || Boolean(value.kind));

export function resolveVoiceSampleSettings(
  locale: VoiceLocale,
  settings: VoiceSampleSettings,
  readingOverride: ReadingNarrationParameters | null = null,
) {
  return {
    voiceModel: settings.models[locale],
    voiceDecoder: selectedNarrationDecoder(settings.models, locale),
    voiceParameters: resolveReadingNarrationParameters(
      resolveNarrationStyle(settings.styles[locale]),
      readingOverride,
    ),
  };
}
