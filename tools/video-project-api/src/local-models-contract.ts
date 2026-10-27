import { z } from "zod";

export const localModelStatusSchema = z.enum([
  "downloaded",
  "not_downloaded",
  "incomplete",
  "unavailable",
  "custom",
  "local",
]);
export const localModelDownloadSchema = z.object({
  status: z.enum(["downloading", "verifying", "completed", "failed"]),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
});
export type LocalModelDownload = z.infer<typeof localModelDownloadSchema>;
export const localModelSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(160),
  role: z.enum(["voice", "alignment", "recognition"]),
  uses: z.array(
    z.object({
      kind: z.enum(["short", "long"]),
      languages: z.array(z.enum(["es", "en", "pt"])),
    }),
  ),
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .nullable(),
  revision: z
    .string()
    .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    .nullable(),
  status: localModelStatusSchema,
  enabled: z.boolean().optional(),
  download: localModelDownloadSchema.optional(),
  variant: z
    .enum([
      "cosyvoice3-base-0.5b",
      "cosyvoice3-rl-0.5b",
      "qwen3-base-0.6b",
      "qwen3-base-1.7b",
      "chatterbox-original",
      "chatterbox-pt-br",
      "chatterbox-v2",
      "chatterbox-v3",
      "chatterbox-shared",
      "chatterbox-latam",
      "qwen3-aligner-0.6b-8bit",
      "qwen3-asr-0.6b-8bit",
      "custom",
    ])
    .default("custom"),
  software: z.object({
    name: z.enum(["chatterbox-tts", "mlx-audio", "qwen-tts", "cosyvoice"]),
    version: z.string().max(100).nullable(),
  }),
});
export const localModelsSchema = z.object({
  checkedAt: z.string().datetime(),
  models: z.array(localModelSchema).max(20),
});
export type LocalModels = z.infer<typeof localModelsSchema>;
export const localModelUpdateSchema = z.object({
  checkedAt: z.string().datetime(),
  model: localModelSchema,
  latestRevision: z
    .string()
    .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    .nullable(),
  status: z.enum([
    "up_to_date",
    "update_available",
    "new_variant",
    "not_downloaded",
    "review_required",
    "unavailable",
    "unsupported",
  ]),
  reason: z.enum([
    "same_revision",
    "same_files",
    "used_files_changed",
    "missing_local",
    "unknown_baseline",
    "unknown_software",
    "format_changed",
    "size_limit",
    "no_public_source",
    "source_unavailable",
    "rate_limited",
  ]),
  compatibility: z.enum(["expected_fit", "review_required", "not_assessed"]),
  downloadBytes: z.number().int().nonnegative().nullable(),
  changedFiles: z.number().int().nonnegative(),
  variants: z
    .array(
      z.object({
        name: z.string().max(160),
        repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        revision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
        compatibility: z.enum(["expected_fit", "review_required"]),
        weightsBytes: z.number().int().nonnegative(),
        requiresIntegration: z.boolean(),
      }),
    )
    .max(3),
  discovery: z.enum(["complete", "unavailable", "not_applicable"]),
});
export type LocalModelUpdate = z.infer<typeof localModelUpdateSchema>;

/** Full-repository removal also affects voices that load shared base components. */
export function localModelRemovalTargets(
  models: LocalModels["models"],
  repository: string | null,
) {
  if (!repository) return [];
  return models.filter(
    (model) =>
      model.repository === repository ||
      (repository === "ResembleAI/chatterbox" &&
        ["chatterbox-latam", "chatterbox-pt-br"].includes(model.variant)),
  );
}
