import fs from "node:fs/promises";
import path from "node:path";
import { existingInternalFile } from "./output-files.js";

export const defaultVersionSettingsFilename = "default-version-settings.json";

async function readOptionalSettings(file: string): Promise<{ volumeMultiplier: number; text: string } | undefined> {
  let text: string;
  try { text = await fs.readFile(file, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new Error(`Invalid JSON in ${file}`); }
  const volumeMultiplier = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as { volumeMultiplier?: unknown }).volumeMultiplier : undefined;
  validateReadingVolume(volumeMultiplier, file);
  return { volumeMultiplier, text };
}

/** Seed version defaults from the first successful render without replacing user edits. */
export async function ensureDefaultVersionSettings(outputDir: string, volumeMultiplier: number): Promise<void> {
  validateReadingVolume(volumeMultiplier);
  const file = path.join(path.dirname(outputDir), defaultVersionSettingsFilename);
  try {
    await fs.writeFile(file, JSON.stringify({ volumeMultiplier }, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export function validateReadingVolume(value: unknown, file = "reading audio settings"): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 4) {
    throw new Error(`volumeMultiplier must be a number between 0 and 4 in ${file}`);
  }
}

/** Session overrides take priority over passage settings, then version defaults, then unity. */
export async function readReadingAudioSettings(outputDir: string, replaceExisting: boolean, override?: number): Promise<{ volumeMultiplier: number; text: string }> {
  if (override !== undefined) {
    validateReadingVolume(override);
    return { volumeMultiplier: override, text: JSON.stringify({ volumeMultiplier: override }, null, 2) + "\n" };
  }
  if (replaceExisting) {
    const settings = await readOptionalSettings(await existingInternalFile(outputDir, "reading-audio.json"));
    if (settings) return settings;
  }
  const versionSettings = await readOptionalSettings(path.join(path.dirname(outputDir), defaultVersionSettingsFilename));
  const volumeMultiplier = versionSettings?.volumeMultiplier ?? 1;
  return { volumeMultiplier, text: JSON.stringify({ volumeMultiplier }, null, 2) + "\n" };
}
