import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const bibleDataRoot = fileURLToPath(
  new URL("../../../apps/frontend/public/bible-data", import.meta.url),
);
export const bibleDataOverridesRoot = fileURLToPath(
  new URL("../resources/bible-data-overrides", import.meta.url),
);

export function overridesForBibleRoot(root: string) {
  return path.resolve(root) === path.resolve(bibleDataRoot)
    ? bibleDataOverridesRoot
    : undefined;
}

/** Fall back only for missing files; invalid overrides must remain visible as errors. */
export async function readBibleDataFile(
  relativePath: string,
  root = bibleDataRoot,
  overridesRoot = overridesForBibleRoot(root),
): Promise<string> {
  if (overridesRoot) {
    try {
      return await fs.readFile(path.join(overridesRoot, relativePath), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return fs.readFile(path.join(root, relativePath), "utf8");
}
