import {
  voiceStageProgress,
  samplingProgress,
} from "../../generation-progress.js";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { config, type Version } from "./config.js";
import type { Passage } from "./episodes.js";

const script = config.ttsScript;
const templateFields = new Set([
  "reference",
  "version",
  "book",
  "start",
  "end",
  "passage_id",
]);
export type VoicePart = "intro" | "outro";
const allParts: readonly VoicePart[] = ["intro", "outro"];

const esSmall = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
];
const enSmall = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const ptSmall = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const esTens = [
  "",
  "",
  "",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];
const enTens = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const ptTens = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const esHundreds = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
];
const ptHundreds = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

export function numberToWords(
  locale: Version["locale"],
  number: number,
): string {
  if (!Number.isSafeInteger(number) || number < 1 || number > 999)
    throw new Error(`Reference number out of range: ${number}`);
  if (locale === "es") {
    if (number < 30) return esSmall[number];
    if (number < 100)
      return `${esTens[Math.floor(number / 10)]}${number % 10 ? ` y ${esSmall[number % 10]}` : ""}`;
    if (number === 100) return "cien";
    return `${esHundreds[Math.floor(number / 100)]}${number % 100 ? ` ${numberToWords(locale, number % 100)}` : ""}`;
  }
  if (locale === "en") {
    if (number < 20) return enSmall[number];
    if (number < 100)
      return `${enTens[Math.floor(number / 10)]}${number % 10 ? `-${enSmall[number % 10]}` : ""}`;
    return `${enSmall[Math.floor(number / 100)]} hundred${number % 100 ? ` and ${numberToWords(locale, number % 100)}` : ""}`;
  }
  if (number < 20) return ptSmall[number];
  if (number < 100)
    return `${ptTens[Math.floor(number / 10)]}${number % 10 ? ` e ${ptSmall[number % 10]}` : ""}`;
  if (number === 100) return "cem";
  return `${ptHundreds[Math.floor(number / 100)]}${number % 100 ? ` e ${numberToWords(locale, number % 100)}` : ""}`;
}

function spokenBookName(locale: Version["locale"], book: string): string {
  const numbered = /^([123]) (.+)$/.exec(book);
  if (!numbered) return book;
  const order = Number(numbered[1]) - 1;
  if (locale === "en")
    return `${["First", "Second", "Third"][order]} ${numbered[2]}`;
  if (locale === "es")
    return `${["Primera", "Segunda", "Tercera"][order]} de ${numbered[2]}`;
  return `${["Primeira", "Segunda", "Terceira"][order]} de ${numbered[2]}`;
}

export interface VoiceContext {
  templates: { intro: string; outro: string };
  locale: Version["locale"];
  reference: string;
  version: string;
  book: string;
  start: string;
  end: string;
  passage_id: string;
}

export function spokenReference(
  locale: Version["locale"],
  book: string,
  passage: Passage,
): string {
  const start = passage.start;
  const end = passage.end;
  const name = spokenBookName(locale, book);
  const startChapter = numberToWords(locale, start.chapter);
  const startVerse = numberToWords(locale, start.verse);
  const endChapter = numberToWords(locale, end.chapter);
  const endVerse = numberToWords(locale, end.verse);
  if (passage.endBook && passage.endBook !== passage.book) {
    const endName = spokenBookName(
      locale,
      passage.endBookName ?? passage.endBook,
    );
    if (locale === "es")
      return `${name}, desde el capítulo ${startChapter} versículo ${startVerse} hasta ${endName} capítulo ${endChapter} versículo ${endVerse}`;
    if (locale === "en")
      return `${name}, from chapter ${startChapter} verse ${startVerse} to ${endName} chapter ${endChapter} verse ${endVerse}`;
    return `${name}, do capítulo ${startChapter} versículo ${startVerse} até ${endName} capítulo ${endChapter} versículo ${endVerse}`;
  }
  if (start.chapter === end.chapter) {
    const single = start.verse === end.verse;
    if (locale === "es")
      return `${name} capítulo ${startChapter} ${single ? "versículo" : "versículos"} ${startVerse}${single ? "" : ` al ${endVerse}`}`;
    if (locale === "en")
      return `${name} chapter ${startChapter} ${single ? "verse" : "verses"} ${startVerse}${single ? "" : ` to ${endVerse}`}`;
    return `${name} capítulo ${startChapter} ${single ? "versículo" : "versículos"} ${startVerse}${single ? "" : ` a ${endVerse}`}`;
  }
  if (locale === "es")
    return `${name}, desde el capítulo ${startChapter} versículo ${startVerse} hasta el capítulo ${endChapter} versículo ${endVerse}`;
  if (locale === "en")
    return `${name}, from chapter ${startChapter} verse ${startVerse} to chapter ${endChapter} verse ${endVerse}`;
  return `${name}, do capítulo ${startChapter} versículo ${startVerse} ao capítulo ${endChapter} versículo ${endVerse}`;
}

export function voiceContext(
  version: Version,
  passage: Passage,
  book: string,
  versionName: string,
  templates = { intro: "", outro: "" },
): VoiceContext {
  return {
    templates,
    locale: version.locale,
    reference: spokenReference(version.locale, book, passage),
    version: versionName,
    book,
    start: `${passage.start.chapter}:${passage.start.verse}`,
    end: `${passage.end.chapter}:${passage.end.verse}`,
    passage_id: passage.id,
  };
}

export async function renderVoiceScripts(
  context: VoiceContext,
): Promise<Record<"intro" | "outro", string>> {
  const templates = context.templates;
  const values = context as unknown as Record<string, string>;
  const render = (part: "intro" | "outro"): string => {
    const template = templates[part];
    if (!template.trim()) return "";
    const result = template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (!templateFields.has(key))
        throw new Error(`Unsupported voice template variable: ${key}`);
      return values[key];
    });
    if (/[{}]/.test(result))
      throw new Error(
        `Invalid braces in voice template ${context.locale}.${part}`,
      );
    return result.trim();
  };
  return { intro: render("intro"), outro: render("outro") };
}

async function isFile(filename: string): Promise<boolean> {
  return fs.stat(filename).then(
    (stat) => stat.isFile(),
    () => false,
  );
}

/** Pick a dedicated sample for each track, then the language-wide sample. */
export async function resolveVoicePrompts(
  locale: VoiceContext["locale"],
  parts: readonly VoicePart[] = allParts,
): Promise<Record<"intro" | "outro", string | null>> {
  const voiceDir = config.voiceDir;
  const fallback = config.ttsVoicePrompts[locale];
  const result: Record<VoicePart, string | null> = { intro: null, outro: null };
  for (const part of parts) {
    const explicit = config.ttsTrackVoicePrompts[locale][part];
    if (explicit !== undefined) {
      if (explicit && !(await isFile(explicit)))
        throw new Error(
          `Voice prompt for ${locale}-${part} does not exist: ${explicit}`,
        );
      result[part] = explicit || null;
      continue;
    }
    const dedicated = ["mp3", "wav"].map((extension) =>
      path.join(voiceDir, `${locale}-${part}.${extension}`),
    );
    result[part] = null;
    for (const candidate of dedicated) {
      if (await isFile(candidate)) {
        result[part] = candidate;
        break;
      }
    }
    if (result[part]) continue;
    if (!fallback) continue;
    if (await isFile(fallback)) {
      result[part] = fallback;
      continue;
    }
    const defaultMp3 = path.join(voiceDir, `${locale}.mp3`);
    const defaultWav = path.join(voiceDir, `${locale}.wav`);
    if (fallback === defaultMp3 && (await isFile(defaultWav))) {
      result[part] = defaultWav;
      continue;
    }
    throw new Error(
      `Voice prompt for ${locale}-${part} does not exist: ${fallback}`,
    );
  }
  return result;
}

async function runFfmpeg(
  source: string,
  target: string,
  codec: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      config.ffmpegBin,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        source,
        "-map",
        "0:a:0",
        "-vn",
        "-c:a",
        codec,
        "-ar",
        "48000",
        target,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let errors = "";
    child.stderr.on("data", (chunk: Buffer) => {
      errors += chunk.toString();
    });
    child.once("error", reject);
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`ffmpeg exited with code ${code}: ${errors.trim()}`),
          ),
    );
  });
}

async function generateElevenLabsVoice(
  outputDir: string,
  locale: VoiceContext["locale"],
  scripts: Partial<Record<VoicePart, string>>,
  force: boolean,
  parts: readonly VoicePart[],
): Promise<void> {
  const apiKey = config.elevenLabsApiKey.trim();
  const voiceId = config.elevenLabsVoices[locale].trim();
  if (!apiKey)
    throw new Error("VIDEO_LONG_ELEVENLABS_API_KEY is missing from .env");
  if (!voiceId)
    throw new Error(
      `VIDEO_LONG_ELEVENLABS_VOICE_${locale.toUpperCase()} is missing from .env`,
    );
  if (!config.elevenLabsModel.trim())
    throw new Error("VIDEO_LONG_ELEVENLABS_MODEL is missing from .env");
  const names = parts.flatMap((part) =>
    ["txt", "wav"].map((extension) => `${part}.${extension}`),
  );
  if (
    !force &&
    (
      await Promise.all(
        names.map((name) =>
          fs.access(path.join(outputDir, name)).then(
            () => true,
            () => false,
          ),
        ),
      )
    ).some(Boolean)
  ) {
    throw new Error(
      "Audio or text files already exist; use the regenerate option to replace them",
    );
  }
  const staging = await fs.mkdtemp(path.join(outputDir, ".voice-elevenlabs-"));
  try {
    for (const part of parts) {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: scripts[part],
            model_id: config.elevenLabsModel,
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(
          `ElevenLabs rejected ${part} (HTTP ${response.status}): ${detail}`,
        );
      }
      const audio = Buffer.from(await response.arrayBuffer());
      if (!audio.length)
        throw new Error(`ElevenLabs returned empty audio for ${part}`);
      const mp3 = path.join(staging, `${part}.mp3`);
      const wav = path.join(staging, `${part}.wav`);
      await fs.writeFile(mp3, audio);
      await runFfmpeg(mp3, wav, "pcm_s24le");
      await fs.writeFile(
        path.join(staging, `${part}.txt`),
        `${scripts[part]}\n`,
        "utf8",
      );
    }
    for (const name of names)
      await fs.rename(path.join(staging, name), path.join(outputDir, name));
    if (force) {
      for (const part of parts)
        await fs.rm(path.join(outputDir, `${part}.aiff`), { force: true });
    }
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

/** Generate named voice tracks in a prepared or temporary short output. */
export async function generateVoice(
  outputDir: string,
  context: VoiceContext,
  force = false,
  part?: VoicePart,
  onProgress?: (progress: number) => void,
): Promise<void> {
  onProgress?.(5);
  const parts = part ? [part] : allParts;
  await fs.mkdir(outputDir, { recursive: true });
  const rendered = await renderVoiceScripts(context);
  for (const name of parts) {
    if (!rendered[name])
      throw new Error(`Missing voice template ${context.locale}.${name}`);
  }
  const scripts = Object.fromEntries(
    parts.map((name) => [name, rendered[name]]),
  );
  if (config.ttsProvider === "elevenlabs") {
    onProgress?.(20);
    await generateElevenLabsVoice(
      outputDir,
      context.locale,
      scripts,
      force,
      parts,
    );
    onProgress?.(100);
    return;
  }
  if (config.ttsProvider !== "chatterbox")
    throw new Error(
      `Unknown voice provider: ${config.ttsProvider}. Use chatterbox or elevenlabs`,
    );
  const staging = await fs.mkdtemp(path.join(outputDir, ".voice-scripts-"));
  try {
    const scriptsPath = path.join(staging, "scripts.json");
    await fs.writeFile(
      scriptsPath,
      JSON.stringify(scripts, null, 2) + "\n",
      "utf8",
    );
    const args = [
      script,
      "--scripts",
      scriptsPath,
      "--language",
      context.locale,
      "--output-dir",
      outputDir,
      "--model",
      config.ttsModels[context.locale],
      "--device",
      config.ttsDevice,
    ];
    const voicePrompts = await resolveVoicePrompts(context.locale, parts);
    const promptsPath = path.join(staging, "voice-prompts.json");
    await fs.writeFile(
      promptsPath,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(voicePrompts).filter(([, filename]) => filename),
        ),
        null,
        2,
      ) + "\n",
      "utf8",
    );
    args.push("--voice-prompts", promptsPath);
    if (force) args.push("--force");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.ttsPython, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stage = "Starting Chatterbox";
      let stageStarted = Date.now();
      let stdoutBuffer = "";
      let stdoutTail = "";
      let stderrTail = "";
      let finished = false;
      const tty = Boolean(process.stdout.isTTY);
      const showProgress = () => {
        if (tty)
          process.stdout.write(
            `\r\x1b[2K${stage} · ${Math.floor((Date.now() - stageStarted) / 1000)} s`,
          );
      };
      const changeStage = (next: string) => {
        if (tty) {
          showProgress();
          process.stdout.write("\n");
        }
        stage = next;
        onProgress?.(voiceStageProgress(next));
        stageStarted = Date.now();
        if (tty) showProgress();
        else console.log(stage);
      };
      if (tty) showProgress();
      else console.log(stage);
      const timer = setInterval(showProgress, 1000);
      child.stdout.on("data", (chunk: Buffer) => {
        stdoutTail = (stdoutTail + chunk.toString()).slice(-6000);
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop()!.slice(-6000);
        for (const line of lines) {
          const match = /Stage: (.+)$/.exec(line.trim());
          if (match) changeStage(match[1]);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-6000);
        const progress = /generating/i.test(stage)
          ? samplingProgress(stderrTail)
          : undefined;
        if (progress !== undefined) onProgress?.(progress);
      });
      const finish = (error?: Error) => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        if (tty) {
          showProgress();
          process.stdout.write("\n");
        }
        if (error) reject(error);
        else resolve();
      };
      child.once("error", (error) => finish(error));
      child.once("close", (code, signal) => {
        if (code === 0) {
          finish();
          return;
        }
        const details = (stderrTail || stdoutTail)
          .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
          .replace(/\r/g, "\n")
          .trim()
          .slice(-3000);
        finish(
          new Error(
            `Voice generation ended with ${signal ?? `exit code ${code}`}${details ? `:\n${details}` : ""}`,
          ),
        );
      });
    });
    onProgress?.(100);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}
