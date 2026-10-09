import { publicationTemplatesSchema } from "./publication-templates.js";
import type { VoicePart } from "./chapter-introductions.js";
import { z } from "zod";
const point = z.object({
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
});
export const settingsSchema = z.object({
  volumeMultiplier: z.number().min(0).max(4).default(1),
  passageOffsets: z
    .object({
      startSeconds: z.number().finite(),
      endSeconds: z.number().finite(),
    })
    .default({ startSeconds: 0, endSeconds: 0 }),
  readingSectionPadding: z
    .array(
      z.object({
        sectionIndex: z.number().int().nonnegative(),
        beforeSeconds: z.number().finite().nonnegative(),
        afterSeconds: z.number().finite().nonnegative(),
      }),
    )
    .max(1000)
    .default([]),
  verseOffsets: z
    .array(
      z.object({
        reference: z.string().min(1),
        startOffsetSeconds: z.number().finite(),
        endOffsetSeconds: z.number().finite(),
      }),
    )
    .default([]),
  background: z
    .string()
    .regex(/^[a-zA-Z0-9_.-]+\.mp4$/)
    .optional(),
});
export const readingCutsSchema = z
  .array(
    z.object({
      reference: z.string().min(1),
      start: z.number().finite().nonnegative(),
      end: z.number().finite().positive(),
    }),
  )
  .min(1)
  .max(1000);
export const renderSchema = z.object({
  readingCuts: readingCutsSchema.optional(),
  id: z.string().uuid(),
  projectId: z.number().int().positive(),
  kind: z.enum(["short", "long"]),
  outputEnvironment: z
    .enum(["production", "development"])
    .default("production"),
  version: z.object({
    id: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    locale: z.enum(["es", "en", "pt"]),
    label: z.string(),
  }),
  passage: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    book: z.string().regex(/^[a-z0-9-]+$/),
    endBook: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    episode: z.number().int().positive().optional(),
    start: point,
    end: point,
  }),
  settings: settingsSchema,
  voiceTemplates: z
    .object({
      intro: z.string().trim().max(10000),
      outro: z.string().trim().max(10000),
    })
    .default({ intro: "", outro: "" }),
  publicationTemplates: publicationTemplatesSchema.default({}),
  socialAccounts: z
    .object({
      youtube: z.string().trim().max(100),
      x: z.string().trim().max(100),
      instagram: z.string().trim().max(100),
      tiktok: z.string().trim().max(100),
      facebook: z.string().trim().max(100),
    })
    .default({ youtube: "", x: "", instagram: "", tiktok: "", facebook: "" }),
  callback: z
    .object({ url: z.string().url(), token: z.string().min(32) })
    .optional(),
});
export const resultSchema = z.object({
  output: z.string(),
  video: z.string(),
  thumbnail: z.string(),
  background: z.string(),
  duration: z.number(),
  readingDuration: z.number(),
  thumbnailTime: z.number(),
  descriptions: z.record(z.string()),
  voiceScripts: z.record(z.string()),
  sources: z.array(z.string()),
  verseCues: z.array(
    z.object({
      reference: z.string(),
      text: z.string(),
      start: z.number(),
      end: z.number(),
    }),
  ),
});
export const updateSchema = z
  .object({
    status: z.enum(["running", "done", "failed"]),
    stage: z.string().max(200),
    error: z.string().max(6000).optional(),
    result: resultSchema.optional(),
  })
  .superRefine((v, c) => {
    if (v.status === "done" && !v.result)
      c.addIssue({ code: "custom", message: "Missing result" });
  });
export type RenderRequest = z.infer<typeof renderSchema>;
export const previewSchema = renderSchema
  .extend({
    readingReferences: z.array(z.string().min(1)).min(1).max(1000).optional(),
    voicePart: z
      .union([
        z.enum(["intro", "outro"]),
        z
          .string()
          .regex(/^chapter-\d+$/)
          .transform((value) => value as VoicePart),
      ])
      .optional(),
  })
  .refine(
    (input) => !(input.readingReferences && input.voicePart),
    "Select only one preview section",
  );
