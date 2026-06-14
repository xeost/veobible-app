/**
 * Main configuration for the Audiobibles CLI tool.
 * Adjust these values to match your environment.
 */
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the project root (audiobibles-cli/src → up two levels reaches veobible-app/)
const projectRoot = path.resolve(__dirname, "..", "..");

export const config = {
  /**
   * Path to the working directory.
   * Contains: sources/audios/, sources/images/, outputs/, logs/
   * This directory is expected to live outside the repository in production.
   * During development it is temporarily placed at material/audiobibles/.
   */
  workingDir:
    process.env.AUDIOBIBLES_WORKING_DIR ??
    "/Users/fabian/Documents/audiobibles",

  /**
   * Path to the bible-data directory inside the web project.
   * Contains: <locale>/<versionId>/index.json for each Bible version.
   */
  bibleDataDir:
    process.env.AUDIOBIBLES_BIBLE_DATA_DIR ??
    path.join(projectRoot, "public", "bible-data"),

  /**
   * Base URL of the published website. Used to construct book page URLs.
   */
  siteBaseUrl: "https://veobible.com",

  /**
   * Gemini chat URL used in Step 1 (Image Prompt).
   * A single fixed URL is opened for all books — the user pastes the
   * rendered prompt there and downloads the generated thumbnail.
   */
  geminiChatUrl: "https://gemini.google.com/app/e5c2ce6391f830d5",

  /**
   * Number of days to keep log files before permanent deletion.
   */
  logRetentionDays: 7,

  /**
   * Scheduling settings for YouTube uploads.
   * Each version has its own independent schedule starting from baseDate.
   * Book 1 is scheduled on the first available publish day on or after baseDate;
   * each subsequent book is scheduled on the next available publish day.
   */
  schedule: {
    /**
     * Anchor date for book scheduling (YYYY-MM-DD).
     * Book 1 of any version is scheduled starting from this date.
     */
    baseDate: "2026-06-05",

    /**
     * Weekdays on which videos are scheduled for publication.
     * Can be specified as a string of comma-separated day names
     * or an array of day names/numbers.
     * Supported formats:
     * - English: "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
     * - Spanish: "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
     * - Numbers: 0 (Sunday) to 6 (Saturday)
     */
    publishDays: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ],

    /**
     * Fixed upload time shown in the YouTube info file.
     * Format: 12-hour clock with AM/PM, e.g. "3:30 PM".
     */
    scheduledTime: "9:00 AM",
  },

  /**
   * Video generation settings.
   */
  video: {
    /**
     * When true, Step 4 will skip the actual FFmpeg rendering and thumbnail
     * copy, but will still probe chapter durations and write the *-upload.txt
     * file. Useful for regenerating upload metadata for books that have
     * already been rendered without waiting hours for re-encoding.
     */
    skipRendering: false,

    visualizer: {
      /** Multiplier for the visualizer's reactivity (e.g. 0.5 to 1.5). Only applies to some styles. */
      sensitivity: 0.8,
      /** Shape of the audio visualization. Valid options: "bars", "wave", "circle", "spectrum". */
      style: "wave" as "bars" | "wave" | "circle" | "spectrum",
      /** Base color of the visualizer waveform or bars in hex format (e.g., "#ffffff"). */
      color: "#ffffff",
      /** Global transparency level of the visualizer, from 0.0 (invisible) to 1.0 (fully solid). */
      opacity: 0.4,
      /** Maximum height of the visualizer in pixels. Will be anchored near the bottom of the video. */
      height: 150,
      /** Number of frequency bands. Applies primarily to "bars" style. */
      bands: 50,
    },
    output: {
      /** FFmpeg video encoder. Usually "libx264" (CPU) or a hardware encoder like "h264_videotoolbox". */
      codec: "libx264",
      /** Constant Rate Factor for x264/x265. Lower is better quality/larger file. Usually between 18 and 28. */
      crf: 22,
      /** Final video resolution width x height. Defaults to standard 1080p ("1920x1080"). */
      resolution: "1920x1080",
      /** Frames per second of the generated video. Higher FPS makes the visualizer smoother. */
      fps: 30,
    },
    loop: {
      /** Duration in seconds of the crossfade transition if looping a background video. (Unused for static images) */
      crossfadeDuration: 1.0,
    },
  },

  /**
   * Bible versions managed by this CLI.
   * Each entry maps to a directory under bibleDataDir/<locale>/<id>/index.json
   * and an audio source directory under sources/audios/<id>/.
   *
   * Optional properties:
   * - youtubeLabel: custom version label used in generated YouTube video titles.
   */
  versions: [
    {
      id: "rv1909",
      locale: "es",
      label: "Reina Valera 1909",
      shortLabel: "RV 1909",
      // youtubeLabel: "RV1909",
    },
    {
      id: "kjv",
      locale: "en",
      label: "King James Version",
      shortLabel: "KJV",
      youtubeLabel: "KJV",
    },
  ],
} as const;
