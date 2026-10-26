import { z } from "zod";
import {
  narrationTextAdaptationsSchema,
  type NarrationTextAdaptations,
} from "./narration-text-adaptations.js";

export const narrationModelSchema = z.enum([
  "qwen3-base-0.6b",
  "qwen3-base-1.7b",
  "chatterbox",
  "multilingual-v3",
  "latam",
  "pt-br",
]);
export type NarrationModel = z.infer<typeof narrationModelSchema>;
export const narrationDecoderSchema = z.enum(["general", "v3"]);
export type NarrationDecoder = z.infer<typeof narrationDecoderSchema>;
export const narrationModelsSchema = z
  .object({
    en: z.enum([
      "chatterbox",
      "multilingual-v3",
      "qwen3-base-0.6b",
      "qwen3-base-1.7b",
    ]),
    es: z.enum([
      "multilingual-v3",
      "latam",
      "qwen3-base-0.6b",
      "qwen3-base-1.7b",
    ]),
    pt: z.enum([
      "multilingual-v3",
      "pt-br",
      "qwen3-base-0.6b",
      "qwen3-base-1.7b",
    ]),
    textAdaptations: z
      .object({
        es: z
          .object({
            "multilingual-v3": narrationTextAdaptationsSchema.optional(),
            latam: narrationTextAdaptationsSchema.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    decoders: z
      .object({
        en: z
          .object({
            chatterbox: narrationDecoderSchema.optional(),
            "multilingual-v3": narrationDecoderSchema.optional(),
          })
          .strict()
          .optional(),
        es: z
          .object({
            latam: narrationDecoderSchema.optional(),
            "multilingual-v3": narrationDecoderSchema.optional(),
          })
          .strict()
          .optional(),
        pt: z
          .object({
            "pt-br": narrationDecoderSchema.optional(),
            "multilingual-v3": narrationDecoderSchema.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type NarrationModels = z.infer<typeof narrationModelsSchema>;
export const defaultNarrationModels = (): NarrationModels => ({
  en: "multilingual-v3",
  es: "multilingual-v3",
  pt: "multilingual-v3",
});
export function selectedNarrationDecoder(
  models: NarrationModels,
  locale: "en" | "es" | "pt",
): NarrationDecoder | undefined {
  const model = models[locale];
  if (isQwenNarrationModel(model)) return undefined;
  const choices = models.decoders?.[locale] as
    Partial<Record<NarrationModel, NarrationDecoder>> | undefined;
  return choices?.[model] ?? (model === "pt-br" ? "v3" : "general");
}
export function narrationModelForLocale(
  model: unknown,
  locale: "en" | "es" | "pt",
): NarrationModel {
  return narrationModelsSchema.shape[locale].parse(model);
}
export function selectedNarrationTextAdaptations(
  models: NarrationModels,
  locale: "en" | "es" | "pt",
): NarrationTextAdaptations | undefined {
  if (locale !== "es") return undefined;
  const selected =
    models.textAdaptations?.es?.[models.es as "latam" | "multilingual-v3"];
  return selected?.reinforceSpanishRs ? selected : undefined;
}
export const isQwenNarrationModel = (model: string) =>
  model.startsWith("qwen3-base-");
export const narrationProvider = (model: string) =>
  isQwenNarrationModel(model) ? "qwen3" : "chatterbox";
const qwenOptions = [
  { value: "qwen3-base-0.6b", label: "Qwen3-TTS Base 0.6B (voice cloning)" },
  { value: "qwen3-base-1.7b", label: "Qwen3-TTS Base 1.7B (voice cloning)" },
] as const;
export const narrationModelOptions = {
  en: [
    ...qwenOptions,
    { value: "chatterbox", label: "Chatterbox" },
    { value: "multilingual-v3", label: "Chatterbox Multilingual (English)" },
  ],
  es: [
    ...qwenOptions,
    {
      value: "multilingual-v3",
      label: "Chatterbox Multilingual (Latin American Spanish)",
    },
    { value: "latam", label: "Chatterbox es-MX Latam" },
  ],
  pt: [
    ...qwenOptions,
    {
      value: "multilingual-v3",
      label: "Chatterbox Multilingual (Brazilian Portuguese)",
    },
    { value: "pt-br", label: "Chatterbox Multilingual pt-BR" },
  ],
} as const;
