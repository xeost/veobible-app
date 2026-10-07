import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { workingDirectories } from "../../working-directories.js";

const toolRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const workingDir = workingDirectories.short;
const sharedVoicePrompt = process.env.VIDEO_SHORT_TTS_VOICE_PROMPT ?? "";
const sharedTtsModel = process.env.VIDEO_SHORT_TTS_MODEL ?? "multilingual";
const voiceDir = path.join(workingDir, "material", "voices");
const homebrewFull =
  process.platform === "darwin"
    ? [
        "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
        "/usr/local/opt/ffmpeg-full/bin/ffmpeg",
      ].find(existsSync)
    : undefined;
const ffmpegBin = process.env.VIDEO_SHORT_FFMPEG || homebrewFull || "ffmpeg";

/** Paths can be set in .env, overridden by process environment variables. */
const settings = {
  workingDir,
  voiceDir,
  ttsScript:
    process.env.VIDEO_TTS_SCRIPT ??
    path.join(toolRoot, "../voice-generator/cli.py"),
  renderConcurrency: process.env.VIDEO_SHORT_RENDER_CONCURRENCY ?? "",
  videosDir:
    process.env.VIDEO_SHORT_VIDEOS_DIR ??
    path.join(workingDir, "material", "videos"),
  ffmpegBin,
  ffprobeBin:
    ffmpegBin === "ffmpeg"
      ? "ffprobe"
      : path.join(path.dirname(ffmpegBin), "ffprobe"),
  clipAudioMode: process.env.VIDEO_SHORT_CLIP_AUDIO_MODE ?? "voice",
  audioDir:
    process.env.VIDEO_SHORT_AUDIO_DIR ??
    process.env.VIDEO_AUDIO_DIR ??
    path.join(workingDir, "material", "bible-audio"),
  bibleDataDir: path.resolve(toolRoot, "../../apps/frontend/public/bible-data"),
  ttsProvider: process.env.VIDEO_SHORT_TTS_PROVIDER ?? "chatterbox",
  elevenLabsApiKey: process.env.VIDEO_SHORT_ELEVENLABS_API_KEY ?? "",
  elevenLabsModel:
    process.env.VIDEO_SHORT_ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
  elevenLabsVoices: {
    es: process.env.VIDEO_SHORT_ELEVENLABS_VOICE_ES ?? "",
    en: process.env.VIDEO_SHORT_ELEVENLABS_VOICE_EN ?? "",
    pt: process.env.VIDEO_SHORT_ELEVENLABS_VOICE_PT ?? "",
  },
  ttsPython:
    process.env.VIDEO_SHORT_TTS_PYTHON ??
    path.join(toolRoot, "../voice-generator/.venv/bin/python"),
  ttsModels: {
    es: process.env.VIDEO_SHORT_TTS_MODEL_ES ?? sharedTtsModel,
    en: process.env.VIDEO_SHORT_TTS_MODEL_EN ?? sharedTtsModel,
    pt: process.env.VIDEO_SHORT_TTS_MODEL_PT ?? sharedTtsModel,
  },
  ttsDevice: process.env.VIDEO_SHORT_TTS_DEVICE ?? "auto",
  ttsVoicePrompts: {
    es:
      process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_ES ??
      (sharedVoicePrompt || path.join(voiceDir, "es.mp3")),
    en:
      process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_EN ??
      (sharedVoicePrompt || path.join(voiceDir, "en.mp3")),
    pt:
      process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_PT ??
      (sharedVoicePrompt || path.join(voiceDir, "pt.mp3")),
  },
  ttsTrackVoicePrompts: {
    es: {
      intro: process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_ES_INTRO,
      outro: process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_ES_OUTRO,
    },
    en: {
      intro: process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_EN_INTRO,
      outro: process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_EN_OUTRO,
    },
    pt: {
      intro: process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_PT_INTRO,
      outro: process.env.VIDEO_SHORT_TTS_VOICE_PROMPT_PT_OUTRO,
    },
  },
  versions: [
    { locale: "es", id: "rv1909", label: "Reina Valera 1909" },
    { locale: "es", id: "spabll", label: "Santa Biblia Libre Latinoamericana" },
    { locale: "en", id: "kjv", label: "King James Version" },
    { locale: "en", id: "web", label: "World English Bible" },
    { locale: "pt", id: "arc", label: "Almeida Revista e Corrigida" },
  ],
} as const;

const resolveInput = (value: string) => path.resolve(toolRoot, value);
export const config = {
  ...settings,
  workingDir: resolveInput(settings.workingDir),
  voiceDir: resolveInput(settings.voiceDir),
  videosDir: resolveInput(settings.videosDir),
  audioDir: resolveInput(settings.audioDir),
  bibleDataDir: resolveInput(settings.bibleDataDir),
  ttsScript: resolveInput(settings.ttsScript),
  ttsPython: resolveInput(settings.ttsPython),
  ttsVoicePrompts: Object.fromEntries(
    Object.entries(settings.ttsVoicePrompts).map(([locale, value]) => [
      locale,
      value ? resolveInput(value) : value,
    ]),
  ) as typeof settings.ttsVoicePrompts,
  ttsTrackVoicePrompts: Object.fromEntries(
    Object.entries(settings.ttsTrackVoicePrompts).map(([locale, tracks]) => [
      locale,
      Object.fromEntries(
        Object.entries(tracks).map(([part, value]) => [
          part,
          value ? resolveInput(value) : value,
        ]),
      ),
    ]),
  ) as typeof settings.ttsTrackVoicePrompts,
};
export type Version = (typeof config.versions)[number];
