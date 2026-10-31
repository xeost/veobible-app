import { narrationTextAdaptationsSchema } from "./narration-text-adaptations.js";
import { narrationPresetSelectionSchema } from "./narration-preset-selection.js";
import { z } from "zod";
import { baseVoiceSchema } from "./base-voice-schema.js";
import {
  narrationModelSchema,
  narrationDecoderSchema,
} from "./narration-models.js";
import { narrationParametersSchema } from "./narration-parameters.js";
export const audioVersionSchema = z.object({
  id: z.number().int().positive(),
  code: z
    .string()
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  locale: z.enum(["es", "en", "pt"]),
  label: z.string().min(1).max(120),
});
export const audioEditionSchema = z
  .string()
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*-v[2-9]\d*$|^[a-z0-9]+(?:-[a-z0-9]+)*-v1\d+$/,
  );
export const audioBookSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const audioTrimSchema = z
  .object({
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().positive(),
  })
  .refine((v) => v.endSeconds - v.startSeconds >= 0.02);
export const audioSettingsSchema = z.object({
  voiceDefaultsVersion: z.literal(1).optional(),
  baseVoice: baseVoiceSchema,
  inheritBaseVoice: z.boolean().optional(),
  narrationPreset: narrationPresetSelectionSchema.optional(),
  pronunciation: z
    .record(z.string().regex(/^\d+:\d+$/), z.string().trim().min(1).max(5000))
    .optional(),
  trims: z.record(z.string().regex(/^\d+:\d+$/), audioTrimSchema).default({}),
  approvals: z
    .record(
      z.string().regex(/^\d+:\d+$/),
      z.object({
        recordingRevision: z.string(),
        trim: audioTrimSchema,
        editingFilesRemoved: z.boolean().optional(),
      }),
    )
    .optional(),
  pauses: z
    .record(z.string().regex(/^\d+:\d+$/), z.number().finite().min(0).max(10))
    .default({}),
});
export const audioSaveSchema = z.object({
  revision: z.number().int().nonnegative(),
  settings: audioSettingsSchema,
});
export const audioSourceSchema = z.object({
  file: z.string().min(1),
  duration: z.number().finite().positive(),
  revision: z.string(),
  text: z.string().optional(),
});
export const audioLayerSchema = audioSourceSchema
  .extend({
    enabled: z.boolean(),
    start: z.number().finite().nonnegative(),
    end: z.number().finite().positive(),
    textStart: z.number().int().nonnegative(),
    textEnd: z.number().int().positive(),
  })
  .refine((v) => v.end > v.start && v.textEnd > v.textStart);
export const audioRecordingSchema = audioSourceSchema
  .extend({
    base: audioSourceSchema.extend({ text: z.string().min(1) }).optional(),
    layers: z.array(audioLayerSchema).max(500).optional(),
  })
  .superRefine((recording, ctx) => {
    const layers = recording.layers ?? [];
    if (
      (layers.length && !recording.base) ||
      new Set(layers.map((layer) => layer.revision)).size !== layers.length ||
      layers.some(
        (layer) =>
          layer.end > (recording.base?.duration ?? 0) ||
          layer.textEnd > (recording.base?.text.length ?? 0),
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid audio layers",
      });
  });
export const audioChapterAssetSchema = z.object({
  file: z.string().min(1),
  revision: z.string(),
  cues: z
    .array(
      z.object({
        verse: z.number().int().positive(),
        text: z.string(),
        start: z.number().nonnegative(),
        end: z.number().positive(),
      }),
    )
    .optional(),
});
export type AudioLayer = z.infer<typeof audioLayerSchema>;
export type AudioRecording = z.infer<typeof audioRecordingSchema>;
export const audioGenerateSchema = z
  .object({
    chapter: z.number().int().positive().optional(),
    verse: z.number().int().positive().optional(),
    regenerate: z.boolean().default(false),
    assembleOnly: z.boolean().default(false),
    voicesOnly: z.boolean().default(false),
    alignOnly: z.boolean().default(false),
    patch: z
      .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().positive(),
        text: z.string().trim().min(1).max(1000),
        sourceText: z.string().min(1).max(5000),
      })
      .refine((v) => v.end > v.start && v.end <= v.sourceText.length)
      .optional(),
    layerEdits: z
      .array(z.object({ revision: z.string(), enabled: z.boolean() }))
      .max(500)
      .optional(),
    textOverride: z.string().trim().min(1).max(5000).optional(),
    voiceModel: narrationModelSchema.optional(),
    voiceDecoder: narrationDecoderSchema.optional(),
    voiceParameters: narrationParametersSchema.optional(),
    voiceTextAdaptations: narrationTextAdaptationsSchema.optional(),
  })
  .refine(
    (v) =>
      v.layerEdits === undefined ||
      (!!v.verse &&
        !v.patch &&
        !v.alignOnly &&
        !v.assembleOnly &&
        !v.regenerate &&
        !v.voicesOnly &&
        v.textOverride === undefined),
  )
  .refine((v) => !v.verse || !!v.chapter)
  .refine(
    (v) =>
      !v.patch ||
      (!!v.verse &&
        !v.alignOnly &&
        !v.assembleOnly &&
        v.textOverride === undefined),
  )
  .refine(
    (v) => !v.assembleOnly || (!v.verse && !v.regenerate && !v.voicesOnly),
  )
  .refine(
    (v) => !v.alignOnly || (!v.assembleOnly && !v.voicesOnly && !v.regenerate),
  )
  .refine(
    (v) =>
      v.textOverride === undefined ||
      (Boolean(v.verse) && !v.assembleOnly && !v.alignOnly),
  );
export type AudioVersion = z.infer<typeof audioVersionSchema>;
export type AudioSettings = z.infer<typeof audioSettingsSchema>;
export const audioEnvironmentSchema = z.enum(["production", "development"]);
export type AudioProject = {
  outputEnvironment: z.infer<typeof audioEnvironmentSchema>;
  edition: string;
  version: AudioVersion;
  book: string;
  title: string;
  order: number;
  chapterCount: number;
  verseCounts: number[];
  settings: AudioSettings;
  revision: number;
  recordings: Record<
    string,
    AudioRecording & {
      synthesis?: {
        model?: z.infer<typeof narrationModelSchema>;
        decoder?: z.infer<typeof narrationDecoderSchema>;
        parameters?: z.infer<typeof narrationParametersSchema>;
      };
    }
  >;
  chapters: Record<string, z.infer<typeof audioChapterAssetSchema>>;
  status: "draft" | "queued" | "running" | "done" | "failed";
  progress: number;
  updatedAt: string;
};
export type AudioProjectDetail = AudioProject & {
  originalChapters?: number[];
  content: { chapter: number; verses: { verse: number; text: string }[] }[];
};
export type AudioProjectSummary = Omit<
  AudioProject,
  "recordings" | "settings" | "revision"
>;

export const audioProjectSchema: z.ZodType<
  AudioProject,
  z.ZodTypeDef,
  unknown
> = z.object({
  outputEnvironment: audioEnvironmentSchema.default("production"),
  edition: audioEditionSchema,
  version: audioVersionSchema,
  book: audioBookSchema,
  title: z.string().min(1).max(200),
  order: z.number().int().positive(),
  chapterCount: z.number().int().positive(),
  verseCounts: z.array(z.number().int().positive()).min(1),
  settings: audioSettingsSchema,
  revision: z.number().int().nonnegative(),
  recordings: z.record(z.string().regex(/^\d+:\d+$/), audioRecordingSchema),
  chapters: z.record(z.string().regex(/^\d+$/), audioChapterAssetSchema),
  status: z.enum(["draft", "queued", "running", "done", "failed"]),
  progress: z.number().finite().min(0).max(100),
  updatedAt: z.string(),
});
export const audioEventSchema = z.object({
  sequence: z.number().int().positive(),
  project: audioProjectSchema,
});
