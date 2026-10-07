import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const bibleDataRoot = fileURLToPath(
  new URL("../../../apps/frontend/public/bible-data/", import.meta.url),
);
const indexSchema = z.object({
  metadata: z.object({ name: z.string().trim().min(1).max(120) }),
  books: z.array(z.unknown()).min(1),
});
export async function availableBibleVersions(root = bibleDataRoot) {
  const versions: {
    locale: "es" | "en" | "pt";
    code: string;
    label: string;
  }[] = [];
  for (const locale of ["es", "en", "pt"] as const) {
    const directories = await fs
      .readdir(path.join(root, locale), { withFileTypes: true })
      .catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      });
    for (const directory of directories) {
      if (
        !directory.isDirectory() ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory.name) ||
        directory.name.length > 60
      )
        continue;
      const content = await fs
        .readFile(path.join(root, locale, directory.name, "index.json"), "utf8")
        .catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
      if (content === null) continue;
      const index = indexSchema.parse(JSON.parse(content));
      versions.push({
        locale,
        code: directory.name,
        label: index.metadata.name,
      });
    }
  }
  return versions.sort(
    (a, b) => a.locale.localeCompare(b.locale) || a.code.localeCompare(b.code),
  );
}

export async function availableBibleBooks(
  locale: "es" | "en" | "pt",
  code: string,
) {
  const data = JSON.parse(
    await fs.readFile(
      path.join(bibleDataRoot, locale, code, "index.json"),
      "utf8",
    ),
  );
  return z
    .object({
      books: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            chapters: z.number().int().positive(),
            versesPerChapter: z.array(z.number().int().positive()),
          }),
        )
        .min(1),
    })
    .parse(data).books;
}
