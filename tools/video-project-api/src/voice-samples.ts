import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { baseVoiceSchema, voiceForLocale } from "./base-voice-schema.js";
import { sharedVoiceDirectory } from "./working-directories.js";
import {
  narrationModelSchema,
  narrationModelForLocale,
} from "./narration-models.js";
import { narrationParametersSchema } from "./narration-parameters.js";
import { generateVoice } from "./engines/short/voice.js";

export const sampleRequestSchema = z
  .object({
    voice: baseVoiceSchema,
    text: z.string().trim().min(1).max(500),
    voiceModel: narrationModelSchema,
    voiceParameters: narrationParametersSchema,
  })
  .strict();
type Status = {
  status: "queued" | "running" | "done" | "failed";
  progress: number;
};
const tasks = new Map<string, Status>();
const samples = path.join(sharedVoiceDirectory, "samples");
export const sampleFile = (id: string) =>
  path.join(samples, `${baseVoiceSchema.parse(id)}-sample.wav`);
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
    const stat = await fs.stat(sampleFile(id)).catch(() => null);
    let metadata: { text?: string; generatedAt?: string } = {};
    try {
      metadata = JSON.parse(
        await fs.readFile(sampleFile(id) + ".json", "utf8"),
      );
    } catch {}
    voices.push({
      id,
      locale: id.split("-")[0],
      available: Boolean(stat?.isFile() && stat.size > 0),
      generatedAt:
        metadata.generatedAt ?? (stat ? stat.mtime.toISOString() : null),
      text: metadata.text ?? null,
      ...(tasks.get(id) ?? { status: "done", progress: 0 }),
    });
  }
  return voices;
}
export async function queueVoiceSample(
  input: z.infer<typeof sampleRequestSchema>,
  enqueue: (run: () => Promise<void>) => void,
) {
  input = sampleRequestSchema.parse(input);
  const locale = z.enum(["es", "en", "pt"]).parse(input.voice.split("-")[0]);
  voiceForLocale(locale, input.voice);
  narrationModelForLocale(input.voiceModel, locale);
  if (!(await listBaseVoices()).some((voice) => voice.id === input.voice))
    throw new Error("Base voice not found");
  const current = tasks.get(input.voice);
  if (current && ["queued", "running"].includes(current.status)) return current;
  const task: Status = { status: "queued", progress: 0 };
  tasks.set(input.voice, task);
  enqueue(async () => {
    task.status = "running";
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
          voiceParameters: input.voiceParameters,
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
      if (!(await fs.stat(output)).size) throw new Error("Empty voice sample");
      await fs.writeFile(
        path.join(staging, "metadata.json"),
        JSON.stringify({ ...input, generatedAt: new Date().toISOString() }),
      );
      await fs.rename(output, sampleFile(input.voice));
      await fs.rename(
        path.join(staging, "metadata.json"),
        sampleFile(input.voice) + ".json",
      );
      task.status = "done";
      task.progress = 100;
    } catch (error) {
      task.status = "failed";
      console.error("Voice sample generation failed", error);
    } finally {
      if (staging) await fs.rm(staging, { recursive: true, force: true });
    }
  });
  return task;
}
