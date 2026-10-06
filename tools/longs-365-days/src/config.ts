import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { config as loadEnv } from "dotenv";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(toolRoot, "../..");

// Always load this tool's .env, regardless of the directory used to launch it.
// Existing process environment variables take precedence.
loadEnv({ path: path.join(toolRoot, ".env"), quiet: true });

const workingDir = process.env.VEOBIBLE_LONGS_WORKING_DIR ?? "/Users/fabian/Documents/veobible-longs";
const sharedVoicePrompt = process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT ?? "";
const sharedTtsModel = process.env.VEOBIBLE_LONGS_TTS_MODEL ?? "multilingual";
const voiceDir = path.join(workingDir, "material", "voices");
const homebrewFull = process.platform === "darwin"
  ? ["/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg", "/usr/local/opt/ffmpeg-full/bin/ffmpeg"].find(existsSync)
  : undefined;
const ffmpegBin = process.env.VEOBIBLE_LONGS_FFMPEG || homebrewFull || "ffmpeg";

/** Paths can be set in .env, overridden by process environment variables. */
export const config = {
  workingDir,
  renderConcurrency: process.env.VEOBIBLE_LONGS_RENDER_CONCURRENCY ?? "",
  outputDir: process.env.VEOBIBLE_LONGS_OUTPUT_DIR ?? path.join(workingDir, "outputs"),
  videosDir: process.env.VEOBIBLE_LONGS_VIDEOS_DIR ?? path.join(workingDir, "material", "videos"),
  socialAccounts: process.env.VEOBIBLE_LONGS_SOCIAL_ACCOUNTS ?? path.join(toolRoot, "social-accounts.json"),
  ffmpegBin,
  mpvBin: process.env.VEOBIBLE_LONGS_MPV || (process.platform === "darwin"
    ? ["/opt/homebrew/bin/mpv", "/usr/local/bin/mpv"].find(existsSync) : undefined) || "mpv",
  ffprobeBin: ffmpegBin === "ffmpeg" ? "ffprobe" : path.join(path.dirname(ffmpegBin), "ffprobe"),
  clipAudioMode: process.env.VEOBIBLE_LONGS_CLIP_AUDIO_MODE ?? "voice",
  audioDir: process.env.VEOBIBLE_LONGS_AUDIO_DIR ?? "/Users/fabian/Documents/audiobibles/sources/audios",
  bibleDataDir: process.env.VEOBIBLE_LONGS_BIBLE_DATA_DIR ?? path.join(projectRoot, "apps/frontend/public/bible-data"),
  ttsProvider: process.env.VEOBIBLE_LONGS_TTS_PROVIDER ?? "chatterbox",
  elevenLabsApiKey: process.env.VEOBIBLE_LONGS_ELEVENLABS_API_KEY ?? "",
  elevenLabsModel: process.env.VEOBIBLE_LONGS_ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
  elevenLabsVoices: {
    es: process.env.VEOBIBLE_LONGS_ELEVENLABS_VOICE_ES ?? "",
    en: process.env.VEOBIBLE_LONGS_ELEVENLABS_VOICE_EN ?? "",
    pt: process.env.VEOBIBLE_LONGS_ELEVENLABS_VOICE_PT ?? ""
  },
  ttsPython: process.env.VEOBIBLE_LONGS_TTS_PYTHON ?? path.join(toolRoot, "../voice-generator/.venv/bin/python"),
  ttsModels: {
    es: process.env.VEOBIBLE_LONGS_TTS_MODEL_ES ?? sharedTtsModel,
    en: process.env.VEOBIBLE_LONGS_TTS_MODEL_EN ?? sharedTtsModel,
    pt: process.env.VEOBIBLE_LONGS_TTS_MODEL_PT ?? sharedTtsModel
  },
  ttsDevice: process.env.VEOBIBLE_LONGS_TTS_DEVICE ?? "auto",
  ttsVoicePrompts: {
    es: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_ES ?? (sharedVoicePrompt || path.join(voiceDir, "es.mp3")),
    en: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_EN ?? (sharedVoicePrompt || path.join(voiceDir, "en.mp3")),
    pt: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_PT ?? (sharedVoicePrompt || path.join(voiceDir, "pt.mp3"))
  },
  ttsTrackVoicePrompts: {
    es: { intro: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_ES_INTRO, outro: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_ES_OUTRO },
    en: { intro: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_EN_INTRO, outro: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_EN_OUTRO },
    pt: { intro: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_PT_INTRO, outro: process.env.VEOBIBLE_LONGS_TTS_VOICE_PROMPT_PT_OUTRO }
  },
  ttsTemplates: process.env.VEOBIBLE_LONGS_TTS_TEMPLATES ?? path.join(toolRoot, "voice-templates.json"),
  versions: [
    { locale: "es", id: "rv1909", label: "Reina Valera 1909" },
    { locale: "es", id: "spabll", label: "Santa Biblia Libre Latinoamericana" },
    { locale: "en", id: "kjv", label: "King James Version" },
    { locale: "en", id: "web", label: "World English Bible" },
    { locale: "pt", id: "arc", label: "Almeida Revista e Corrigida" }
  ]
} as const;

export type Version = (typeof config.versions)[number];
