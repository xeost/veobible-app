import { z } from "zod";

export const loudnessTargetSchema = z.union([z.literal(-14), z.literal(-16)]);
export const loudnessSettingsSchema = z.object({
  es: loudnessTargetSchema,
  en: loudnessTargetSchema,
  pt: loudnessTargetSchema,
});
export type LoudnessSettings = z.infer<typeof loudnessSettingsSchema>;
export const defaultLoudnessSettings = (): LoudnessSettings => ({
  es: -14,
  en: -14,
  pt: -14,
});
