import fs from "node:fs/promises";
import path from "node:path";

const names: Record<string, string> = {
  "metadata.txt": "0-metadata.txt",
  "intro.wav": "1-intro.wav",
  "intro.txt": "1-intro.txt",
  "versiculos.txt": "2-versiculos.txt",
  "offsets.json": "2-passage-audio-offsets.json",
  "reading-audio.json": "2-passage-audio-settings.json",
  "verse-offsets.json": "2-verse-text-offsets.json",
  "outro.wav": "3-outro.wav",
  "outro.txt": "3-outro.txt"
};

export function internalFilename(name: string): string {
  if (!names[name]) throw new Error(`Unknown internal output file: ${name}`);
  return names[name];
}

/** Prefer the new layout, while preserving editable files from earlier outputs. */
export async function existingInternalFile(outputDir: string, name: string): Promise<string> {
  const current = path.join(outputDir, "_internal", internalFilename(name));
  const previousName = name === "offsets.json" ? "2-offsets.json" : name === "verse-offsets.json" ? "2-verse-offsets.json" : undefined;
  const candidates = [current, ...(previousName ? [path.join(outputDir, "_internal", previousName)] : []), path.join(outputDir, "internal", name), path.join(outputDir, name)];
  for (const file of candidates) {
    try {
      await fs.access(file);
      return file;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return current;
}
