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
  baseVoice: baseVoiceSchema,
  trims: z.record(z.string().regex(/^\d+:\d+$/), audioTrimSchema).default({}),
  pauses: z
    .record(z.string().regex(/^\d+:\d+$/), z.number().finite().min(0).max(10))
    .default({}),
});
export const audioSaveSchema = z.object({
  revision: z.number().int().nonnegative(),
  settings: audioSettingsSchema,
});
export const audioGenerateSchema = z
  .object({
    chapter: z.number().int().positive().optional(),
    verse: z.number().int().positive().optional(),
    regenerate: z.boolean().default(false),
    voiceModel: narrationModelSchema.optional(),
    voiceDecoder: narrationDecoderSchema.optional(),
    voiceParameters: narrationParametersSchema.optional(),
  })
  .refine((v) => !v.verse || !!v.chapter);
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
    {
      file: string;
      duration: number;
      revision: string;
      synthesis?: {
        model?: z.infer<typeof narrationModelSchema>;
        decoder?: z.infer<typeof narrationDecoderSchema>;
        parameters?: z.infer<typeof narrationParametersSchema>;
      };
    }
  >;
  chapters: Record<string, { file: string; revision: string }>;
  status: "draft" | "queued" | "running" | "done" | "failed";
  progress: number;
  updatedAt: string;
};
export type AudioProjectDetail = AudioProject & {
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
  recordings: z.record(
    z.string().regex(/^\d+:\d+$/),
    z.object({
      file: z.string().min(1),
      duration: z.number().finite().positive(),
      revision: z.string(),
    }),
  ),
  chapters: z.record(
    z.string().regex(/^\d+$/),
    z.object({ file: z.string().min(1), revision: z.string() }),
  ),
  status: z.enum(["draft", "queued", "running", "done", "failed"]),
  progress: z.number().finite().min(0).max(100),
  updatedAt: z.string(),
});
export const audioEventSchema = z.object({
  sequence: z.number().int().positive(),
  project: audioProjectSchema,
});
