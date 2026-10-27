import { assertNarrationModelEnabled } from "./local-model-state.js";
import { narrationTextAdaptationsSchema } from "./narration-text-adaptations.js";
import { randomUUID } from "node:crypto";
import type { GenerationQueue, QueueJob } from "./generation-queue.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { baseVoiceSchema, voiceForLocale } from "./base-voice-schema.js";
import { sharedVoiceDirectory } from "./working-directories.js";
import {
  narrationModelSchema,
  narrationModelIdentity,
  narrationModelOptions,
  narrationDecoderSchema,
  narrationModelForLocale,
} from "./narration-models.js";
import {
  narrationParametersSchema,
  effectiveNarrationParameters,
} from "./narration-parameters.js";
import { generateVoice } from "./engines/short/voice.js";

export const sampleRequestSchema = z
  .object({
    voice: baseVoiceSchema,
    text: z.string().trim().min(1).max(500),
    voiceModel: narrationModelSchema,
    voiceDecoder: narrationDecoderSchema.optional(),
    voiceParameters: narrationParametersSchema,
    voiceTextAdaptations: narrationTextAdaptationsSchema.optional(),
    outputEnvironment: z
      .enum(["production", "development"])
      .default("production"),
  })
  .strict();
const tasks = new Map<string, QueueJob>();
const saving = new Set<string>();
let previewMutation = Promise.resolve();
async function mutatePreviews<T>(run: () => Promise<T>): Promise<T> {
  const previous = previewMutation;
  let release!: () => void;
  previewMutation = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await run();
  } finally {
    release();
  }
}
export class VoiceSampleConflict extends Error {}
const samples = path.join(sharedVoiceDirectory, "samples");
export const sampleFile = (id: string, model?: string) =>
  path.join(
    samples,
    `${baseVoiceSchema.parse(id)}${model ? `-${narrationModelSchema.parse(model)}` : ""}-sample.wav`,
  );
const previewMetadataFile = (id: string, model: string) =>
  sampleFile(id, model).replace(/-sample\.wav$/, "-preview.json");
const previewFile = (id: string, model: string, previewId: string) =>
  sampleFile(id, model).replace(
    /-sample\.wav$/,
    `-preview-${z.string().uuid().parse(previewId)}.wav`,
  );
async function removeOtherPreviews(keep: readonly string[] = []) {
  const preserved = new Set(keep.map((file) => path.basename(file)));
  for (const entry of await fs.readdir(samples, { withFileTypes: true })) {
    if (!entry.isFile() || preserved.has(entry.name)) continue;
    const match =
      /^((?:es|en|pt)-[1-9]\d*)-(.+)-preview(?:-([0-9a-f-]{36}))?\.(wav|json)$/.exec(
        entry.name,
      );
    if (!match || !narrationModelSchema.safeParse(match[2]).success) continue;
    if (
      match[4] === "wav"
        ? !z.string().uuid().safeParse(match[3]).success
        : Boolean(match[3])
    )
      continue;
    await fs.rm(path.join(samples, entry.name), { force: true });
  }
}
const previewMetadataSchema = z
  .object({
    voice: baseVoiceSchema,
    voiceModel: narrationModelSchema,
    previewId: z.string().uuid(),
    text: z.string(),
    generatedAt: z.string(),
  })
  .passthrough();
async function readPreview(id: string, model: string) {
  try {
    const metadata = previewMetadataSchema.parse(
      JSON.parse(await fs.readFile(previewMetadataFile(id, model), "utf8")),
    );
    if (metadata.voice !== id || metadata.voiceModel !== model) return null;
    const file = previewFile(id, model, metadata.previewId);
    const stat = await fs.stat(file);
    return stat.isFile() && stat.size > 0 ? { file, metadata } : null;
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" ||
      error instanceof SyntaxError ||
      error instanceof z.ZodError
    )
      return null;
    throw error;
  }
}
export async function storedPreviewFile(
  id: string,
  model: string,
  previewId: string,
) {
  const preview = await readPreview(id, model);
  return preview?.metadata.previewId === previewId ? preview.file : undefined;
}
export async function saveVoiceSample(
  id: string,
  model: string,
  previewId: string,
) {
  baseVoiceSchema.parse(id);
  narrationModelSchema.parse(model);
  z.string().uuid().parse(previewId);
  const key = `${id}:${model}`;
  if (
    saving.has(key) ||
    ["queued", "running"].includes(tasks.get(key)?.status ?? "")
  )
    throw new VoiceSampleConflict(
      "Wait for the voice example to finish before saving it.",
    );
  saving.add(key);
  let staging: string | undefined;
  try {
    await mutatePreviews(async () => {
      const preview = await readPreview(id, model);
      if (!preview || preview.metadata.previewId !== previewId)
        throw new VoiceSampleConflict(
          "This temporary example is no longer available. Generate another example.",
        );
      staging = await fs.mkdtemp(path.join(samples, ".saving-"));
      const { previewId: _, ...metadata } = preview.metadata;
      await fs.copyFile(preview.file, path.join(staging, "sample.wav"));
      await fs.writeFile(
        path.join(staging, "metadata.json"),
        JSON.stringify(metadata, null, 2) + "\n",
      );
      await fs.rename(path.join(staging, "sample.wav"), sampleFile(id, model));
      await fs.rename(
        path.join(staging, "metadata.json"),
        sampleFile(id, model) + ".json",
      );
      await removeOtherPreviews();
      tasks.delete(key);
    });
  } finally {
    try {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
    } finally {
      saving.delete(key);
    }
  }
}

/** Legacy samples remain readable only under the model recorded in their metadata. */
export async function storedSampleFile(id: string, model?: string) {
  const file = sampleFile(id, model);
  if (
    await fs.stat(file).then(
      (stat) => stat.isFile() && stat.size > 0,
      () => false,
    )
  )
    return file;
  if (model) {
    const legacy = sampleFile(id);
    const metadata = await fs
      .readFile(legacy + ".json", "utf8")
      .then(
        (text) => JSON.parse(text),
        () => null,
      )
      .catch(() => null);
    if (metadata?.voiceModel === model) return legacy;
  }
  return file;
}
async function sampleState(id: string, model?: string) {
  const file = await storedSampleFile(id, model);
  const stat = await fs.stat(file).catch(() => null);
  let metadata: { text?: string; generatedAt?: string } = {};
  try {
    metadata = JSON.parse(await fs.readFile(file + ".json", "utf8"));
  } catch {}
  const preview = model ? await readPreview(id, model) : null;
  return {
    available: Boolean(stat?.isFile() && stat.size > 0),
    generatedAt:
      metadata.generatedAt ?? (stat ? stat.mtime.toISOString() : null),
    text: metadata.text ?? null,
    preview: preview
      ? {
          id: preview.metadata.previewId,
          text: preview.metadata.text,
          generatedAt: preview.metadata.generatedAt,
          available: true,
        }
      : null,
    status: tasks.get(`${id}:${model}`)?.status ?? "done",
    progress: tasks.get(`${id}:${model}`)?.progress ?? 0,
  };
}
export async function listBaseVoices() {
  const names = await fs.readdir(sharedVoiceDirectory).catch((error) => {
    if (error.code === "ENOENT") return [] as string[];
    throw error;
  });
  const voices = [];
  for (const name of names.sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  )) {
    if (!/^(es|en|pt)-[1-9]\d*\.mp3$/.test(name)) continue;
    if (!(await fs.stat(path.join(sharedVoiceDirectory, name))).isFile())
      continue;
    const id = name.slice(0, -4);
    const locale = id.split("-")[0] as "en" | "es" | "pt";
    const variants = await Promise.all(
      narrationModelOptions[locale].map(async ({ value }) => ({
        voiceModel: value,
        ...(await sampleState(id, value)),
      })),
    );
    // Preserve the unfiltered catalogue contract for existing voice pickers.
    const latest =
      variants
        .filter((item) => item.available)
        .sort((a, b) =>
          (b.generatedAt ?? "").localeCompare(a.generatedAt ?? ""),
        )[0] ?? (await sampleState(id));
    const pending = variants.find((item) =>
      ["queued", "running"].includes(item.status),
    );
    voices.push({
      id,
      locale,
      ...latest,
      voiceModel:
        "voiceModel" in latest ? (latest.voiceModel as string) : undefined,
      ...(pending
        ? { status: pending.status, progress: pending.progress }
        : {}),
      samples: variants,
    });
  }
  return voices;
}
export async function queueVoiceSample(
  input: z.infer<typeof sampleRequestSchema>,
  queue: GenerationQueue,
) {
  input = sampleRequestSchema.parse(input);
  const locale = z.enum(["es", "en", "pt"]).parse(input.voice.split("-")[0]);
  voiceForLocale(locale, input.voice);
  narrationModelForLocale(input.voiceModel, locale);
  assertNarrationModelEnabled(input.voiceModel);
  if (!(await listBaseVoices()).some((voice) => voice.id === input.voice))
    throw new Error("Base voice not found");
  const key = `${input.voice}:${input.voiceModel}`;
  if (saving.has(key))
    throw new VoiceSampleConflict(
      "Wait for the voice example to finish saving.",
    );
  const current = tasks.get(key);
  if (current && ["queued", "running"].includes(current.status)) return current;
  const task: QueueJob = {
    id: randomUUID(),
    status: "queued",
    stage: "Queued",
    progress: 0,
  };
  tasks.set(key, task);
  queue.enqueue(
    {
      projectId: null,
      kind: "voice-sample",
      type: "voice-sample",
      voice: input.voice,
      locale,
      outputEnvironment: input.outputEnvironment,
    },
    task,
    async () => {
      task.status = "running";
      task.stage = "Generating voice";
      let staging: string | undefined;
      let published = false;
      const destination = previewFile(input.voice, input.voiceModel, task.id);
      try {
        await fs.mkdir(samples, { recursive: true });
        staging = await fs.mkdtemp(path.join(samples, ".generating-"));
        await generateVoice(
          staging,
          {
            locale,
            baseVoice: input.voice,
            voiceModel: input.voiceModel,
            voiceDecoder: input.voiceDecoder,
            voiceParameters: input.voiceParameters,
            voiceTextAdaptations: input.voiceTextAdaptations,
            reference: "",
            version: "",
            book: "",
            start: "",
            end: "",
            passage_id: "sample",
            templates: { intro: "", outro: "" },
            scriptOverrides: { intro: input.text },
          },
          true,
          "intro",
          (progress) => {
            task.progress = progress;
          },
        );
        const output = path.join(staging, "intro.wav");
        if (!(await fs.stat(output)).size)
          throw new Error("Empty voice sample");
        await fs.writeFile(
          path.join(staging, "metadata.json"),
          JSON.stringify(
            {
              ...input,
              previewId: task.id,
              ...narrationModelIdentity(input.voiceModel),
              voiceParameters: effectiveNarrationParameters(
                input.voiceParameters,
                input.voiceModel,
              ),
              voiceDecoder:
                input.voiceDecoder ??
                (input.voiceModel === "latam"
                  ? "general"
                  : input.voiceModel === "pt-br"
                    ? "v3"
                    : undefined),
              generatedAt: new Date().toISOString(),
            },
            null,
            2,
          ) + "\n",
        );
        const metadataFile = path.join(staging, "metadata.json");
        await mutatePreviews(async () => {
          await fs.rename(output, destination);
          await fs.rename(
            metadataFile,
            previewMetadataFile(input.voice, input.voiceModel),
          );
          published = true;
          await removeOtherPreviews([
            destination,
            previewMetadataFile(input.voice, input.voiceModel),
          ]);
        });
        task.stage = "Done";
        task.status = "done";
        task.progress = 100;
      } catch (error) {
        task.stage = "Failed";
        task.status = "failed";
        console.error("Voice sample generation failed", error);
      } finally {
        if (!published) await fs.rm(destination, { force: true });
        if (staging) await fs.rm(staging, { recursive: true, force: true });
      }
    },
  );
  return task;
}
