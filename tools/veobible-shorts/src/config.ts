import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(toolRoot, "../..");

// Always load this tool's .env, regardless of the directory used to launch it.
// Existing process environment variables take precedence.
loadEnv({ path: path.join(toolRoot, ".env"), quiet: true });

const workingDir = process.env.VEOBIBLE_SHORTS_WORKING_DIR ?? "/Users/fabian/Documents/veobible-shorts";

/** Paths can be set in .env, overridden by process environment variables. */
export const config = {
  workingDir,
  outputDir: process.env.VEOBIBLE_SHORTS_OUTPUT_DIR ?? path.join(workingDir, "outputs"),
  audioDir: process.env.VEOBIBLE_SHORTS_AUDIO_DIR ?? "/Users/fabian/Documents/audiobibles/sources/audios",
  bibleDataDir: process.env.VEOBIBLE_SHORTS_BIBLE_DATA_DIR ?? path.join(projectRoot, "frontend/public/bible-data"),
  versions: [
    { locale: "es", id: "rv1909", label: "Reina Valera 1909" },
    { locale: "es", id: "spabll", label: "Santa Biblia Libre Latinoamericana" },
    { locale: "en", id: "kjv", label: "King James Version" },
    { locale: "en", id: "web", label: "World English Bible" },
    { locale: "pt", id: "arc", label: "Almeida Revista e Corrigida" }
  ]
} as const;

export type Version = (typeof config.versions)[number];
