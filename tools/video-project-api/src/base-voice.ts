import { voiceForLocale } from "./base-voice-schema.js";
import fs from "node:fs/promises";
import path from "node:path";
import { sharedVoiceDirectory } from "./working-directories.js";

type VoicePart = "intro" | "outro";
type VoiceLocale = "es" | "en" | "pt";

export const baseVoiceSample = (locale: VoiceLocale, selected?: string) =>
  path.join(sharedVoiceDirectory, `${voiceForLocale(locale, selected)}.mp3`);

/** Keep the default identity stable when more numbered samples are added.
 * Base samples are permanent library assets: never rename, replace or delete them.
 */
export async function resolveBaseVoicePrompts(
  locale: VoiceLocale,
  parts: readonly VoicePart[] = ["intro", "outro"],
  selected?: string,
): Promise<Record<VoicePart, string | null>> {
  const sample = baseVoiceSample(locale, selected);
  const exists = await fs.stat(sample).then(
    (stat) => stat.isFile(),
    () => false,
  );
  if (!exists) throw new Error(`Base voice sample does not exist: ${sample}`);
  return {
    intro: parts.includes("intro") ? sample : null,
    outro: parts.includes("outro") ? sample : null,
  };
}
