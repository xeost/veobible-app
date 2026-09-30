import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config, type Version } from "./config.js";
import type { Passage } from "./shorts.js";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../veobible-voice/cli.py");
const templateFields = new Set(["reference", "version", "book", "start", "end", "passage_id"]);

export interface VoiceContext {
  locale: Version["locale"];
  reference: string;
  version: string;
  book: string;
  start: string;
  end: string;
  passage_id: string;
}

export function voiceContext(version: Version, passage: Passage, book: string, versionName: string, reference: string): VoiceContext {
  return {
    locale: version.locale,
    reference,
    version: versionName,
    book,
    start: `${passage.start.chapter}:${passage.start.verse}`,
    end: `${passage.end.chapter}:${passage.end.verse}`,
    passage_id: passage.id
  };
}

export async function renderVoiceScripts(context: VoiceContext): Promise<Record<"intro" | "outro", string>> {
  const raw: unknown = JSON.parse(await fs.readFile(config.ttsTemplates, "utf8"));
  if (!raw || typeof raw !== "object") throw new Error(`Plantillas de voz inválidas: ${config.ttsTemplates}`);
  const templates = (raw as Record<string, unknown>)[context.locale];
  if (!templates || typeof templates !== "object") throw new Error(`Faltan plantillas para ${context.locale}`);
  const values = context as unknown as Record<string, string>;
  const render = (part: "intro" | "outro"): string => {
    const template = (templates as Record<string, unknown>)[part];
    if (typeof template !== "string" || !template.trim()) throw new Error(`Falta plantilla ${context.locale}.${part}`);
    const result = template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (!templateFields.has(key)) throw new Error(`Variable de plantilla no permitida: ${key}`);
      return values[key];
    });
    if (/[{}]/.test(result)) throw new Error(`Llaves inválidas en plantilla ${context.locale}.${part}`);
    return result.trim();
  };
  return { intro: render("intro"), outro: render("outro") };
}

/** Generate named voice tracks in a prepared or temporary short output. */
export async function generateVoice(outputDir: string, context: VoiceContext, force = false): Promise<void> {
  const scripts = await renderVoiceScripts(context);
  const staging = await fs.mkdtemp(path.join(outputDir, ".voice-scripts-"));
  try {
    const scriptsPath = path.join(staging, "scripts.json");
    await fs.writeFile(scriptsPath, JSON.stringify(scripts, null, 2) + "\n", "utf8");
    const args = [script, "--scripts", scriptsPath, "--language", context.locale, "--output-dir", outputDir, "--model", config.ttsModels[context.locale], "--device", config.ttsDevice];
    const voicePrompt = config.ttsVoicePrompts[context.locale];
    if (voicePrompt) {
      try { await fs.access(voicePrompt); } catch {
        throw new Error(`No existe la muestra de voz para ${context.locale}: ${voicePrompt}`);
      }
      args.push("--voice-prompt", voicePrompt);
    }
    if (force) args.push("--force");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.ttsPython, args, { stdio: "inherit" });
      child.once("error", reject);
      child.once("close", (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(`La generación de voz terminó con ${signal ?? `código ${code}`}`));
      });
    });
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
