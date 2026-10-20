import { z } from "zod";
export const readingVoiceSettingsSchema = z.record(
  z.string().regex(/^\d+$/),
  z.object({
    enabled: z.boolean(),
    verseOffsets: z
      .array(
        z.object({
          reference: z.string().min(1),
          startOffsetSeconds: z.number().finite(),
          endOffsetSeconds: z.number().finite(),
          manuallyAdjusted: z.boolean().optional(),
        }),
      )
      .default([]),
  }),
);
