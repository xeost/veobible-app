import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const point = z.object({
  book: identifier,
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
});
export const projectProposalsSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      slug: identifier,
      start: point,
      end: point,
    }),
  )
  .superRefine((proposals, ctx) => {
    if (
      new Set(proposals.map((row) => row.slug)).size !== proposals.length ||
      new Set(proposals.map((row) => row.id)).size !== proposals.length
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate proposal identifier",
      });
  });
const bibleDataRoot = fileURLToPath(
  new URL("../../../apps/frontend/public/bible-data/", import.meta.url),
);
export async function loadProjectProposals(
  kind: "short" | "long",
  version: { locale: "es" | "en" | "pt"; code: string },
  directory?: string,
  bibleRoot = bibleDataRoot,
) {
  const root =
    directory ??
    (await import("./working-directories.js")).workingDirectory(kind);
  const proposals = projectProposalsSchema.parse(
    JSON.parse(
      await fs.readFile(
        path.join(root, "material", "video-project-presets.json"),
        "utf8",
      ),
    ),
  );
  const index = z
    .object({ books: z.array(z.object({ id: z.string(), name: z.string() })) })
    .parse(
      JSON.parse(
        await fs.readFile(
          path.join(bibleRoot, version.locale, version.code, "index.json"),
          "utf8",
        ),
      ),
    );
  const names = new Map(index.books.map((book) => [book.id, book.name]));
  return proposals.map((proposal) => {
    const startName = names.get(proposal.start.book),
      endName = names.get(proposal.end.book);
    if (!startName || !endName)
      throw new Error(
        "Proposal book is absent from the selected Bible version",
      );
    const start = `${startName} ${proposal.start.chapter}:${proposal.start.verse}`;
    const end =
      proposal.start.book !== proposal.end.book
        ? `${endName} ${proposal.end.chapter}:${proposal.end.verse}`
        : proposal.start.chapter !== proposal.end.chapter
          ? `${proposal.end.chapter}:${proposal.end.verse}`
          : String(proposal.end.verse);
    const prefix =
      kind === "long"
        ? `${{ es: "Día", en: "Day", pt: "Dia" }[version.locale]} ${String(proposal.id).padStart(3, "0")} · `
        : "";
    return { ...proposal, title: `${prefix}${start}–${end}` };
  });
}
