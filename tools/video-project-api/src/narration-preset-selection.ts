import { z } from "zod";
import {
  narrationParametersSchema,
  type NarrationParameters,
} from "./narration-parameters.js";

// Preserve the chosen values with the voice choice, even if the library changes later.
export const narrationPresetSelectionSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().trim().min(1).max(80),
    settings: narrationParametersSchema,
  })
  .strict();
export type NarrationPresetSelection = z.infer<
  typeof narrationPresetSelectionSchema
>;
export const voiceStylePresetsSchema = z
  .object({
    intro: narrationPresetSelectionSchema.optional(),
    outro: narrationPresetSelectionSchema.optional(),
    reading: narrationPresetSelectionSchema.optional(),
  })
  .strict();
export type VoiceStylePresets = z.infer<typeof voiceStylePresetsSchema>;
export const voiceStyleDefaultsSchema = z
  .object({
    en: voiceStylePresetsSchema,
    es: voiceStylePresetsSchema,
    pt: voiceStylePresetsSchema,
  })
  .strict();
export type VoiceStyleDefaults = z.infer<typeof voiceStyleDefaultsSchema>;
export const emptyVoiceStyleDefaults = (): VoiceStyleDefaults => ({
  en: {},
  es: {},
  pt: {},
});
export function selectedVoiceStyleParameters(
  general: NarrationParameters,
  defaults: VoiceStylePresets,
  project: VoiceStylePresets | undefined,
  role: keyof VoiceStylePresets,
): NarrationParameters {
  return { ...((project?.[role] ?? defaults[role])?.settings ?? general) };
}
