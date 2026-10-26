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
const samples = path.join(sharedVoiceDirectory, "samples");
export const sampleFile = (id: string, model?: string) =>
  path.join(
    samples,
    `${baseVoiceSchema.parse(id)}${model ? `-${narrationModelSchema.parse(model)}` : ""}-sample.wav`,
  );

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
  return {
    available: Boolean(stat?.isFile() && stat.size > 0),
    generatedAt:
      metadata.generatedAt ?? (stat ? stat.mtime.toISOString() : null),
    text: metadata.text ?? null,
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
  if (!(await listBaseVoices()).some((voice) => voice.id === input.voice))
    throw new Error("Base voice not found");
  const key = `${input.voice}:${input.voiceModel}`;
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
          JSON.stringify({
            ...input,
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
          }),
        );
        await fs.rename(output, sampleFile(input.voice, input.voiceModel));
        await fs.rename(
          path.join(staging, "metadata.json"),
          sampleFile(input.voice, input.voiceModel) + ".json",
        );
        task.stage = "Done";
        task.status = "done";
        task.progress = 100;
      } catch (error) {
        task.stage = "Failed";
        task.status = "failed";
        console.error("Voice sample generation failed", error);
      } finally {
        if (staging) await fs.rm(staging, { recursive: true, force: true });
      }
    },
  );
  return task;
}
