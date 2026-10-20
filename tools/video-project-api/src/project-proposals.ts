import fs from "node:fs/promises";
import path from "node:path";
import { bibleDataRoot, readBibleDataFile } from "./bible-data.js";
import { availableBibleBooks } from "./bible-versions.js";
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
export async function loadProjectProposals(
  kind: "short" | "long" | "book",
  version: { locale: "es" | "en" | "pt"; code: string },
  directory?: string,
  bibleRoot = bibleDataRoot,
) {
  if (kind === "book") {
    const books = await availableBibleBooks(
      version.locale,
      version.code,
      bibleRoot,
    );
    return books.map((book, index) => {
      const lastVerse = book.versesPerChapter[book.chapters - 1];
      if (!lastVerse || book.versesPerChapter.length !== book.chapters)
        throw new Error("Invalid book chapter boundaries");
      return {
        id: index + 1,
        slug: book.id,
        title: book.name,
        start: { book: book.id, chapter: 1, verse: 1 },
        end: { book: book.id, chapter: book.chapters, verse: lastVerse },
      };
    });
  }
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
        await readBibleDataFile(
          path.join(version.locale, version.code, "index.json"),
          bibleRoot,
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
