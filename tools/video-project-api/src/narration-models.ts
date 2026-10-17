import { z } from "zod";

export const narrationModelSchema = z.enum([
  "chatterbox",
  "multilingual-v3",
  "latam",
  "pt-br",
]);
export type NarrationModel = z.infer<typeof narrationModelSchema>;
export const narrationModelsSchema = z
  .object({
    en: z.enum(["chatterbox", "multilingual-v3"]),
    es: z.enum(["multilingual-v3", "latam"]),
    pt: z.enum(["multilingual-v3", "pt-br"]),
  })
  .strict();
export type NarrationModels = z.infer<typeof narrationModelsSchema>;
export const defaultNarrationModels = (): NarrationModels => ({
  en: "multilingual-v3",
  es: "multilingual-v3",
  pt: "multilingual-v3",
});
export function narrationModelForLocale(
  model: unknown,
  locale: "en" | "es" | "pt",
): NarrationModel {
  return narrationModelsSchema.shape[locale].parse(model);
}
export const narrationModelOptions = {
  en: [
    { value: "chatterbox", label: "Chatterbox" },
    { value: "multilingual-v3", label: "Chatterbox Multilingual (English)" },
  ],
  es: [
    {
      value: "multilingual-v3",
      label: "Chatterbox Multilingual (Latin American Spanish)",
    },
    { value: "latam", label: "Chatterbox es-MX Latam" },
  ],
  pt: [
    {
      value: "multilingual-v3",
      label: "Chatterbox Multilingual (Brazilian Portuguese)",
    },
    { value: "pt-br", label: "Chatterbox Multilingual pt-BR" },
  ],
} as const;
