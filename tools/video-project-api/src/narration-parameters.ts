import { z } from "zod";
import {
  modelSettingsSchema,
  qwenParametersSchema,
  qwenDefaults,
} from "./narration-model-settings.js";
import { isQwenNarrationModel } from "./narration-models.js";

export const narrationControls = {
  exaggeration: { min: 0, max: 2, step: 0.05 },
  cfg_weight: { min: 0, max: 1, step: 0.05 },
  temperature: { min: 0.05, max: 5, step: 0.05 },
  repetition_penalty: { min: 1, max: 2, step: 0.05 },
} as const;
const customFields = {
  exaggeration: z.number().finite().min(0).max(2),
  cfg_weight: z.number().finite().min(0).max(1),
  temperature: z.number().finite().min(0.05).max(5),
};
export const narrationParametersSchema = z
  .object({
    ...customFields,
    modelSettings: modelSettingsSchema.optional(),
    min_p: z.literal(0.05),
    top_p: z.literal(1),
    repetition_penalty: z.number().finite().min(1).max(2),
  })
  .strict();
export type NarrationParameters = z.infer<typeof narrationParametersSchema>;
export const readingNarrationParametersSchema = narrationParametersSchema.omit({
  min_p: true,
  top_p: true,
});
export type ReadingNarrationParameters = z.infer<
  typeof readingNarrationParametersSchema
>;
export const readingNarrationOverridesSchema = z
  .object({
    en: readingNarrationParametersSchema.nullable(),
    es: readingNarrationParametersSchema.nullable(),
    pt: readingNarrationParametersSchema.nullable(),
  })
  .strict();
export type ReadingNarrationOverrides = z.infer<
  typeof readingNarrationOverridesSchema
>;
export const defaultReadingNarrationOverrides =
  (): ReadingNarrationOverrides => ({ en: null, es: null, pt: null });
export function resolveReadingNarrationParameters(
  general: NarrationParameters,
  override: ReadingNarrationParameters | null,
): NarrationParameters {
  return { ...general, ...override };
}
const fixed = { min_p: 0.05, top_p: 1, repetition_penalty: 2 } as const;
export const narrationPresets = {
  natural: { exaggeration: 0.5, cfg_weight: 0.5, temperature: 0.8, ...fixed },
  expressive: {
    exaggeration: 0.7,
    cfg_weight: 0.3,
    temperature: 0.8,
    ...fixed,
  },
  relaxed: { exaggeration: 0.5, cfg_weight: 0.3, temperature: 0.7, ...fixed },
} satisfies Record<string, NarrationParameters>;
export const narrationStyleSchema = z.discriminatedUnion("preset", [
  z.object({ preset: z.enum(["natural", "expressive", "relaxed"]) }).strict(),
  z
    .object({
      preset: z.literal("custom"),
      ...customFields,
      modelSettings: modelSettingsSchema.optional(),
      repetition_penalty: z.number().finite().min(1).max(2).default(1.2),
    })
    .strict(),
]);
export type NarrationStyle = z.infer<typeof narrationStyleSchema>;
export const narrationStylesSchema = z
  .object({
    en: narrationStyleSchema,
    es: narrationStyleSchema,
    pt: narrationStyleSchema,
  })
  .strict();
export type NarrationStyles = z.infer<typeof narrationStylesSchema>;
export const defaultNarrationStyles = (): NarrationStyles => ({
  en: { preset: "natural" },
  es: { preset: "natural" },
  pt: { preset: "natural" },
});
export function resolveNarrationStyle(
  style: NarrationStyle,
): NarrationParameters {
  if (style.preset !== "custom") return { ...narrationPresets[style.preset] };
  const { preset, ...controls } = style;
  return { ...fixed, ...controls };
}
/** Resolve only the chosen model at the synthesis boundary. Legacy flat settings remain valid. */
export function effectiveNarrationParameters(
  parameters: NarrationParameters | undefined,
  model: string,
) {
  const parsed = narrationParametersSchema.parse(
    parameters ?? narrationPresets.natural,
  );
  const { modelSettings, ...legacy } = parsed;
  const selected = modelSettings?.[model];
  return isQwenNarrationModel(model)
    ? qwenParametersSchema.parse(selected ?? qwenDefaults)
    : narrationParametersSchema
        .omit({ modelSettings: true })
        .parse(selected ?? legacy);
}
export function narrationParameterArgs(
  parameters?: NarrationParameters,
  model = "multilingual-v3",
): string[] {
  if (!parameters && !isQwenNarrationModel(model)) return [];
  return Object.entries(
    effectiveNarrationParameters(parameters, model),
  ).flatMap(([key, value]) => [`--${key.replaceAll("_", "-")}`, String(value)]);
}
