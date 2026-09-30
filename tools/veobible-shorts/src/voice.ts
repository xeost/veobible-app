import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config, type Version } from "./config.js";
import type { Passage } from "./shorts.js";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../veobible-voice/cli.py");
const templateFields = new Set(["reference", "version", "book", "start", "end", "passage_id"]);

const esSmall = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const enSmall = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const ptSmall = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const esTens = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const enTens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ptTens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const esHundreds = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
const ptHundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

export function numberToWords(locale: Version["locale"], number: number): string {
  if (!Number.isSafeInteger(number) || number < 1 || number > 999) throw new Error(`Número de referencia fuera de rango: ${number}`);
  if (locale === "es") {
    if (number < 30) return esSmall[number];
    if (number < 100) return `${esTens[Math.floor(number / 10)]}${number % 10 ? ` y ${esSmall[number % 10]}` : ""}`;
    if (number === 100) return "cien";
    return `${esHundreds[Math.floor(number / 100)]}${number % 100 ? ` ${numberToWords(locale, number % 100)}` : ""}`;
  }
  if (locale === "en") {
    if (number < 20) return enSmall[number];
    if (number < 100) return `${enTens[Math.floor(number / 10)]}${number % 10 ? `-${enSmall[number % 10]}` : ""}`;
    return `${enSmall[Math.floor(number / 100)]} hundred${number % 100 ? ` and ${numberToWords(locale, number % 100)}` : ""}`;
  }
  if (number < 20) return ptSmall[number];
  if (number < 100) return `${ptTens[Math.floor(number / 10)]}${number % 10 ? ` e ${ptSmall[number % 10]}` : ""}`;
  if (number === 100) return "cem";
  return `${ptHundreds[Math.floor(number / 100)]}${number % 100 ? ` e ${numberToWords(locale, number % 100)}` : ""}`;
}

function spokenBookName(locale: Version["locale"], book: string): string {
  const numbered = /^([123]) (.+)$/.exec(book);
  if (!numbered) return book;
  const order = Number(numbered[1]) - 1;
  if (locale === "en") return `${["First", "Second", "Third"][order]} ${numbered[2]}`;
  if (locale === "es") return `${["Primera", "Segunda", "Tercera"][order]} de ${numbered[2]}`;
  return `${["Primeira", "Segunda", "Terceira"][order]} de ${numbered[2]}`;
}

export interface VoiceContext {
  locale: Version["locale"];
  reference: string;
  version: string;
  book: string;
  start: string;
  end: string;
  passage_id: string;
}

export function spokenReference(locale: Version["locale"], book: string, passage: Passage): string {
  const start = passage.start;
  const end = passage.end;
  const name = spokenBookName(locale, book);
  const startChapter = numberToWords(locale, start.chapter);
  const startVerse = numberToWords(locale, start.verse);
  const endChapter = numberToWords(locale, end.chapter);
  const endVerse = numberToWords(locale, end.verse);
  if (start.chapter === end.chapter) {
    const single = start.verse === end.verse;
    if (locale === "es") return `${name} capítulo ${startChapter} ${single ? "versículo" : "versículos"} ${startVerse}${single ? "" : ` al ${endVerse}`}`;
    if (locale === "en") return `${name} chapter ${startChapter} ${single ? "verse" : "verses"} ${startVerse}${single ? "" : ` to ${endVerse}`}`;
    return `${name} capítulo ${startChapter} ${single ? "versículo" : "versículos"} ${startVerse}${single ? "" : ` a ${endVerse}`}`;
  }
  if (locale === "es") return `${name}, desde el capítulo ${startChapter} versículo ${startVerse} hasta el capítulo ${endChapter} versículo ${endVerse}`;
  if (locale === "en") return `${name}, from chapter ${startChapter} verse ${startVerse} to chapter ${endChapter} verse ${endVerse}`;
  return `${name}, do capítulo ${startChapter} versículo ${startVerse} ao capítulo ${endChapter} versículo ${endVerse}`;
}

export function voiceContext(version: Version, passage: Passage, book: string, versionName: string): VoiceContext {
  return {
    locale: version.locale,
    reference: spokenReference(version.locale, book, passage),
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
