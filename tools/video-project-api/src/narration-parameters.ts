import { z } from "zod";

export const narrationControls = {
  exaggeration: { min: 0, max: 2, step: 0.05 },
  cfg_weight: { min: 0, max: 1, step: 0.05 },
  temperature: { min: 0.05, max: 5, step: 0.05 },
} as const;
const customFields = {
  exaggeration: z.number().finite().min(0).max(2),
  cfg_weight: z.number().finite().min(0).max(1),
  temperature: z.number().finite().min(0.05).max(5),
};
export const narrationParametersSchema = z
  .object({
    ...customFields,
    min_p: z.literal(0.05),
    top_p: z.literal(1),
    repetition_penalty: z.literal(1.2),
  })
  .strict();
export type NarrationParameters = z.infer<typeof narrationParametersSchema>;
const fixed = { min_p: 0.05, top_p: 1, repetition_penalty: 1.2 } as const;
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
  z.object({ preset: z.literal("custom"), ...customFields }).strict(),
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
  return { ...controls, ...fixed };
}
export function narrationParameterArgs(
  parameters?: NarrationParameters,
): string[] {
  if (!parameters) return [];
  return Object.entries(narrationParametersSchema.parse(parameters)).flatMap(
    ([key, value]) => [`--${key.replaceAll("_", "-")}`, String(value)],
  );
}
