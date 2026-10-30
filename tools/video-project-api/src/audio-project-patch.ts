import { z } from "zod";
import {
  audioSettingsSchema,
  audioTrimSchema,
  type AudioProject,
} from "./audio-project-schema.js";

const reference = z.string().regex(/^\d+:\d+$/);
const recording = z.object({
  file: z.string().min(1),
  duration: z.number().finite().positive(),
  revision: z.string(),
});
export const audioPatchEventSchema = z.object({
  sequence: z.number().int().positive(),
  baseSequence: z.number().int().nonnegative(),
  patch: z
    .object({
      recordings: z.record(reference, recording.nullable()),
      chapters: z.record(
        z.string().regex(/^\d+$/),
        z.object({ file: z.string().min(1), revision: z.string() }).nullable(),
      ),
      settings: z
        .object({
          pronunciation: z.record(reference, z.string().nullable()).optional(),
          baseVoice: audioSettingsSchema.shape.baseVoice.optional(),
          voiceDefaultsVersion: z.literal(1).nullable().optional(),
          inheritBaseVoice: z.boolean().nullable().optional(),
          narrationPreset: audioSettingsSchema.shape.narrationPreset
            .unwrap()
            .nullable()
            .optional(),
          trims: z.record(reference, audioTrimSchema.nullable()).optional(),
          pauses: z
            .record(reference, z.number().finite().min(0).max(10).nullable())
            .optional(),
          approvals: z
            .record(
              reference,
              z
                .object({
                  recordingRevision: z.string(),
                  trim: audioTrimSchema,
                  editingFilesRemoved: z.boolean().optional(),
                })
                .nullable(),
            )
            .optional(),
        })
        .strict(),
      status: z.enum(["draft", "queued", "running", "done", "failed"]),
      progress: z.number().finite().min(0).max(100),
    })
    .strict(),
});
export type AudioProjectPatch = z.infer<typeof audioPatchEventSchema>["patch"];

function changed<T>(before: Record<string, T>, after: Record<string, T>) {
  const patch: Record<string, T | null> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      patch[key] = after[key] ?? null;
  }
  return patch;
}
/** Compute on the local service; the Worker receives only changed recordings/cuts. */
export function audioProjectPatch(
  before: AudioProject,
  after: AudioProject,
): AudioProjectPatch {
  return {
    recordings: changed(before.recordings, after.recordings),
    chapters: changed(before.chapters, after.chapters),
    settings: {
      // Resolved voice settings also have to reach the persisted project.
      pronunciation: changed(
        before.settings.pronunciation ?? {},
        after.settings.pronunciation ?? {},
      ),
      baseVoice: after.settings.baseVoice,
      voiceDefaultsVersion: after.settings.voiceDefaultsVersion ?? null,
      inheritBaseVoice: after.settings.inheritBaseVoice ?? null,
      narrationPreset: after.settings.narrationPreset ?? null,
      trims: changed(before.settings.trims, after.settings.trims),
      pauses: changed(before.settings.pauses, after.settings.pauses),
      approvals: changed(
        before.settings.approvals ?? {},
        after.settings.approvals ?? {},
      ),
    },
    status: after.status,
    progress: after.progress,
  };
}
