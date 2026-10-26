import { z } from "zod";
export const qwenParametersSchema = z
  .object({
    temperature: z.number().finite().min(0.05).max(2),
    top_p: z.number().finite().min(0.01).max(1),
    top_k: z.number().int().min(1).max(100),
    repetition_penalty: z.number().finite().min(1).max(2),
    max_new_tokens: z.number().int().min(128).max(4096),
  })
  .strict();
export const qwenDefaults = {
  temperature: 0.9,
  top_p: 1,
  top_k: 50,
  repetition_penalty: 1.05,
  max_new_tokens: 2048,
};
export const qwenControls = {
  temperature: { min: 0.05, max: 2, step: 0.05 },
  top_p: { min: 0.01, max: 1, step: 0.01 },
  top_k: { min: 1, max: 100, step: 1 },
  repetition_penalty: { min: 1, max: 2, step: 0.05 },
  max_new_tokens: { min: 128, max: 4096, step: 1 },
} as const;
const chatterboxSettings = z
  .object({
    exaggeration: z.number().finite().min(0).max(2),
    cfg_weight: z.number().finite().min(0).max(1),
    temperature: z.number().finite().min(0.05).max(5),
    min_p: z.literal(0.05),
    top_p: z.literal(1),
    repetition_penalty: z.number().finite().min(1).max(2),
  })
  .strict();
// Each model owns its namespace. Unknown models survive edits and round trips.
export const modelSettingsSchema = z
  .record(z.string().min(1).max(100), z.record(z.unknown()))
  .superRefine((entries, ctx) => {
    for (const model of ["chatterbox", "multilingual-v3", "latam", "pt-br"]) {
      if (
        entries[model] &&
        !chatterboxSettings.safeParse(entries[model]).success
      )
        ctx.addIssue({
          code: "custom",
          path: [model],
          message: "Invalid voice model settings",
        });
    }
    for (const model of ["qwen3-base-0.6b", "qwen3-base-1.7b"]) {
      if (
        entries[model] &&
        !qwenParametersSchema.safeParse(entries[model]).success
      )
        ctx.addIssue({
          code: "custom",
          path: [model],
          message: "Invalid voice model settings",
        });
    }
  });
