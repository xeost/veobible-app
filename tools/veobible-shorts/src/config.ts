import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(toolRoot, "../..");

// Always load this tool's .env, regardless of the directory used to launch it.
// Existing process environment variables take precedence.
loadEnv({ path: path.join(toolRoot, ".env"), quiet: true });

const workingDir = process.env.VEOBIBLE_SHORTS_WORKING_DIR ?? "/Users/fabian/Documents/veobible-shorts";
const sharedVoicePrompt = process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT ?? "";
const sharedTtsModel = process.env.VEOBIBLE_SHORTS_TTS_MODEL ?? "multilingual";
const voiceDir = path.join(workingDir, "material", "voices");

/** Paths can be set in .env, overridden by process environment variables. */
export const config = {
  workingDir,
  outputDir: process.env.VEOBIBLE_SHORTS_OUTPUT_DIR ?? path.join(workingDir, "outputs"),
  audioDir: process.env.VEOBIBLE_SHORTS_AUDIO_DIR ?? "/Users/fabian/Documents/audiobibles/sources/audios",
  bibleDataDir: process.env.VEOBIBLE_SHORTS_BIBLE_DATA_DIR ?? path.join(projectRoot, "frontend/public/bible-data"),
  ttsProvider: process.env.VEOBIBLE_SHORTS_TTS_PROVIDER ?? "chatterbox",
  elevenLabsApiKey: process.env.VEOBIBLE_SHORTS_ELEVENLABS_API_KEY ?? "",
  elevenLabsModel: process.env.VEOBIBLE_SHORTS_ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
  elevenLabsVoices: {
    es: process.env.VEOBIBLE_SHORTS_ELEVENLABS_VOICE_ES ?? "",
    en: process.env.VEOBIBLE_SHORTS_ELEVENLABS_VOICE_EN ?? "",
    pt: process.env.VEOBIBLE_SHORTS_ELEVENLABS_VOICE_PT ?? ""
  },
  ttsPython: process.env.VEOBIBLE_SHORTS_TTS_PYTHON ?? path.join(toolRoot, "../veobible-voice/.venv/bin/python"),
  ttsModels: {
    es: process.env.VEOBIBLE_SHORTS_TTS_MODEL_ES ?? sharedTtsModel,
    en: process.env.VEOBIBLE_SHORTS_TTS_MODEL_EN ?? sharedTtsModel,
    pt: process.env.VEOBIBLE_SHORTS_TTS_MODEL_PT ?? sharedTtsModel
  },
  ttsDevice: process.env.VEOBIBLE_SHORTS_TTS_DEVICE ?? "auto",
  ttsVoicePrompts: {
    es: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES ?? (sharedVoicePrompt || path.join(voiceDir, "es.mp3")),
    en: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN ?? (sharedVoicePrompt || path.join(voiceDir, "en.mp3")),
    pt: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT ?? (sharedVoicePrompt || path.join(voiceDir, "pt.mp3"))
  },
  ttsTrackVoicePrompts: {
    es: { intro: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_INTRO, outro: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_ES_OUTRO },
    en: { intro: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN_INTRO, outro: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_EN_OUTRO },
    pt: { intro: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT_INTRO, outro: process.env.VEOBIBLE_SHORTS_TTS_VOICE_PROMPT_PT_OUTRO }
  },
  ttsTemplates: process.env.VEOBIBLE_SHORTS_TTS_TEMPLATES ?? path.join(toolRoot, "voice-templates.json"),
  versions: [
    { locale: "es", id: "rv1909", label: "Reina Valera 1909" },
    { locale: "es", id: "spabll", label: "Santa Biblia Libre Latinoamericana" },
    { locale: "en", id: "kjv", label: "King James Version" },
    { locale: "en", id: "web", label: "World English Bible" },
    { locale: "pt", id: "arc", label: "Almeida Revista e Corrigida" }
  ]
} as const;

export type Version = (typeof config.versions)[number];
